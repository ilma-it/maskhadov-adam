param(
    [int]$Port = 8080
)

$script:root = $PSScriptRoot
if (-not $script:root) { $script:root = (Get-Location).Path }

$script:mimeTypes = @{
    ".html"   = "text/html; charset=utf-8"
    ".htm"    = "text/html; charset=utf-8"
    ".css"    = "text/css; charset=utf-8"
    ".js"     = "application/javascript; charset=utf-8"
    ".json"   = "application/json; charset=utf-8"
    ".png"    = "image/png"
    ".jpg"    = "image/jpeg"
    ".jpeg"   = "image/jpeg"
    ".gif"    = "image/gif"
    ".svg"    = "image/svg+xml"
    ".ico"    = "image/x-icon"
    ".webp"   = "image/webp"
    ".mp4"    = "video/mp4"
    ".webm"   = "video/webm"
    ".glb"    = "model/gltf-binary"
    ".gltf"   = "model/gltf+json"
    ".bin"    = "application/octet-stream"
    ".dae"    = "model/vnd.collada+xml"
    ".woff"   = "font/woff"
    ".woff2"  = "font/woff2"
    ".ttf"    = "font/ttf"
}

$listener = $null
$bound = $false

while (-not $bound -and $Port -lt 8100) {
    try {
        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Add("http://localhost:$Port/")
        $listener.Prefixes.Add("http://127.0.0.1:$Port/")
        $listener.Start()
        $bound = $true
    } catch {
        if ($listener) {
            try { $listener.Close() } catch {}
            $listener = $null
        }
        $Port++
    }
}

if (-not $bound) {
    Write-Host "[ERROR] Could not bind server to ports 8080-8100." -ForegroundColor Red
    Read-Host "Press Enter to exit..."
    exit 1
}

$url = "http://localhost:$Port/"
Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "          SMART GREENHOUSE - LOCAL WEB & 3D SERVER               " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  [OK] Server running at:      $url" -ForegroundColor Yellow
Write-Host "  [OK] Project folder:         $script:root" -ForegroundColor Gray
Write-Host "  [OK] 3D Model (GLB) & Video: ENABLED" -ForegroundColor Green
Write-Host ""
Write-Host "  -> Opening website in your default browser..." -ForegroundColor Cyan
Write-Host "  -> To stop the server, close this window or press Ctrl + C" -ForegroundColor Gray
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

try {
    Start-Process $url -ErrorAction SilentlyContinue
} catch {}

try {
    while ($listener.IsListening) {
        try {
            $context = $listener.GetContext()
        } catch {
            if (-not $listener.IsListening) { break }
            continue
        }

        try {
            $req = $context.Request
            $res = $context.Response

            # Enable CORS
            $res.AddHeader("Access-Control-Allow-Origin", "*")
            $res.AddHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
            $res.AddHeader("Access-Control-Allow-Headers", "*")

            if ($req.HttpMethod -eq "OPTIONS") {
                $res.StatusCode = 200
                $res.Close()
                continue
            }

            $rawPath = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)
            if ($rawPath -eq "/" -or $rawPath -eq "") {
                $rawPath = "/index.html"
            }

            $relPath = $rawPath.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
            $filePath = [System.IO.Path]::Combine($script:root, $relPath)

            if ([System.IO.File]::Exists($filePath)) {
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $mime = if ($script:mimeTypes.ContainsKey($ext)) { $script:mimeTypes[$ext] } else { "application/octet-stream" }
                $res.ContentType = $mime

                $fileInfo = New-Object System.IO.FileInfo($filePath)
                $totalLength = $fileInfo.Length

                $rangeHeader = $req.Headers["Range"]
                if ($rangeHeader -and $rangeHeader.StartsWith("bytes=")) {
                    $rangeParts = $rangeHeader.Substring(6).Split("-")
                    $start = [int64]$rangeParts[0]
                    $end = if ($rangeParts.Length -gt 1 -and $rangeParts[1] -ne "") { [int64]$rangeParts[1] } else { $totalLength - 1 }
                    if ($end -ge $totalLength) { $end = $totalLength - 1 }
                    $length = $end - $start + 1

                    $res.StatusCode = 206
                    $res.AddHeader("Content-Range", "bytes $start-$end/$totalLength")
                    $res.ContentLength64 = $length

                    $fs = [System.IO.File]::OpenRead($filePath)
                    try {
                        [void]$fs.Seek($start, [System.IO.SeekOrigin]::Begin)
                        $buffer = New-Object byte[] 65536
                        $remaining = $length
                        while ($remaining -gt 0) {
                            $toRead = [int][Math]::Min($buffer.Length, $remaining)
                            $read = $fs.Read($buffer, 0, $toRead)
                            if ($read -le 0) { break }
                            $res.OutputStream.Write($buffer, 0, $read)
                            $remaining -= $read
                        }
                    } finally {
                        $fs.Close()
                    }
                } else {
                    $res.StatusCode = 200
                    $res.ContentLength64 = $totalLength
                    if ($req.HttpMethod -ne "HEAD") {
                        $fs = [System.IO.File]::OpenRead($filePath)
                        try {
                            $buffer = New-Object byte[] 65536
                            while (($read = $fs.Read($buffer, 0, $buffer.Length)) -gt 0) {
                                $res.OutputStream.Write($buffer, 0, $read)
                            }
                        } finally {
                            $fs.Close()
                        }
                    }
                }
            } else {
                $res.StatusCode = 404
                $bytes = [System.Text.Encoding]::UTF8.GetBytes("404 File Not Found: $rawPath")
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
            }
        } catch {
        } finally {
            try { $context.Response.Close() } catch {}
        }
    }
} finally {
    if ($listener -and $listener.IsListening) {
        $listener.Stop()
    }
}