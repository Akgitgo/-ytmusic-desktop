; Custom NSIS installer script for YT Music Desktop
; Registers the ytmusic:// deep-link protocol in Windows registry

!macro customInstall
  WriteRegStr HKCU "Software\Classes\ytmusic" "" "URL:ytmusic Protocol"
  WriteRegStr HKCU "Software\Classes\ytmusic" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\ytmusic\shell\open\command" "" '"$INSTDIR\YT Music.exe" "%1"'

  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\App Paths\YT Music.exe" "" "$INSTDIR\YT Music.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\App Paths\YT Music.exe" "Path" "$INSTDIR"
!macroend

!macro customUninstall
  DeleteRegKey HKCU "Software\Classes\ytmusic"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\App Paths\YT Music.exe"
!macroend
