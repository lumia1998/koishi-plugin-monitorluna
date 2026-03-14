' MonitorLuna Agent 静默启动脚本（无控制台窗口）
Dim objShell, objFSO, strDir, strUV
Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' 获取当前脚本所在目录
strDir = objFSO.GetParentFolderName(WScript.ScriptFullName)

' 确定 uv 路径
If objFSO.FileExists(strDir & "\uv.exe") Then
    strUV = """" & strDir & "\uv.exe"""
Else
    ' 检查系统 PATH（尝试直接用 uv）
    strUV = "uv"
    ' 如果不存在则先下载
    On Error Resume Next
    objShell.Run "powershell -WindowStyle Hidden -ExecutionPolicy Bypass -Command ""$env:UV_INSTALL_DIR='" & strDir & "'; irm https://astral.sh/uv/install.ps1 | iex""", 0, True
    On Error GoTo 0
    If objFSO.FileExists(strDir & "\uv.exe") Then
        strUV = """" & strDir & "\uv.exe"""
    End If
End If

' 静默启动（0 = 隐藏窗口，False = 不等待）
objShell.Run "cmd /c cd /d """ & strDir & """ && " & strUV & " run --project """ & strDir & """ python """ & strDir & "\screenshot-server.py""", 0, False

Set objShell = Nothing
Set objFSO = Nothing
