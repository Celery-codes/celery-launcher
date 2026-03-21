; installer.nsh — Custom NSIS pages injected into electron-builder installer
; Checks for Java 21 and offers to open the download page if missing

!macro customInstallMode
  ; Run as user, not admin — keeps it simple
!macroend

!macro customWelcomePage
  ; Nothing extra on welcome page
!macroend

!macro customInstallPage
  ; Nothing extra on install page  
!macroend

!macro customInstallStep
  ; After install — check for Java
  nsExec::ExecToStack '"javaw" -version'
  Pop $0
  Pop $1
  ${If} $0 != 0
    MessageBox MB_YESNO "Java was not found on your system.$\n$\nCelery Launcher requires Java 21 to play Minecraft.$\n$\nWould you like to open the Java download page now?" IDYES openJava IDNO skipJava
    openJava:
      ExecShell "open" "https://adoptium.net/temurin/releases/?version=21&os=windows&arch=x64&package=jdk"
    skipJava:
  ${EndIf}
!macroend

!macro customUnInstall
  ; Nothing extra on uninstall
!macroend
