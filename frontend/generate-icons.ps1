Add-Type -AssemblyName System.Drawing
foreach ($size in @(192, 512)) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = 'AntiAlias'
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#0a0e1a'))
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#3b82f6'))
    $points = @(@(290,70),@(130,280),@(240,280),@(220,442),@(382,212),@(272,212)) | ForEach-Object { New-Object System.Drawing.PointF(($_[0]*$size/512),($_[1]*$size/512)) }
    $graphics.FillPolygon($brush, [System.Drawing.PointF[]]$points)
    $bitmap.Save((Join-Path $PSScriptRoot "public/icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $brush.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
