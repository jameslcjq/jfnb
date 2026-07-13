!macro preInit
  SetRegView 64
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "D:\laojiu\jfnb\jfnb"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "D:\laojiu\jfnb\jfnb"
  SetRegView 32
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "D:\laojiu\jfnb\jfnb"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "D:\laojiu\jfnb\jfnb"
!macroend

!macro customInit
  StrCpy $INSTDIR "D:\laojiu\jfnb\jfnb"
!macroend

!macro customInstall
  CreateDirectory "D:\laojiu\jfnb\jfdata"
  IfFileExists "D:\laojiu\jfnb\jfdata\经费年报模板.xlsx" doneTemplate
    IfFileExists "$INSTDIR\resources\经费年报模板.xlsx" 0 doneTemplate
      CopyFiles /SILENT "$INSTDIR\resources\经费年报模板.xlsx" "D:\laojiu\jfnb\jfdata\经费年报模板.xlsx"
  doneTemplate:
!macroend
