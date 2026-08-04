$adb = "D:\PythonFile\musicgame\platform-tools\adb.exe"
for ($i = 1; $i -le 4; $i++) {
    & $adb shell "am force-stop org.musou.musicmusou" 2>&1 | Out-Null
    & $adb logcat -c 2>&1 | Out-Null
    & $adb shell "monkey -p org.musou.musicmusou -c android.intent.category.LAUNCHER 1" 2>&1 | Out-Null
    Start-Sleep 10
    $procId = (& $adb shell "pidof org.musou.musicmusou" 2>&1).Trim()
    & $adb logcat -d > "D:\PythonFile\musicgame\buildctx\logcat_try$i.txt" 2>&1
    $line = Get-Content "D:\PythonFile\musicgame\buildctx\logcat_try$i.txt" | Select-String -Pattern "musou\]|FATAL EXCEPTION" | Select-Object -First 1
    $info = if ($line) { $line.Line.Substring(0, [Math]::Min(90, $line.Line.Length)) } else { "no musou/no fatal" }
    Write-Output "try $i : pid=$procId :: $info"
}
