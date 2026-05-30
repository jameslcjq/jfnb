!macro preInit
  SetRegView 64
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "D:\laojiu\gznb"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "D:\laojiu\gznb"
  SetRegView 32
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "D:\laojiu\gznb"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "D:\laojiu\gznb"
!macroend

!macro customInit
  StrCpy $INSTDIR "D:\laojiu\gznb"
!macroend

!macro customInstall
  CreateDirectory "D:\laojiu\gzdata"
  IfFileExists "D:\laojiu\gzdata\经费年报模板.xlsx" doneTemplate
    IfFileExists "$INSTDIR\resources\经费年报模板.xlsx" 0 doneTemplate
      CopyFiles /SILENT "$INSTDIR\resources\经费年报模板.xlsx" "D:\laojiu\gzdata\经费年报模板.xlsx"
  doneTemplate:
!macroend
