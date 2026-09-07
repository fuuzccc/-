; 未来备忘录 安装脚本（UI 与本体浅色主题保持一致）
Unicode true

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

; ---------- 常量 ----------
!define PRODUCT_NAME "未来备忘录"
!define PRODUCT_VERSION "1.0.2"
!define PRODUCT_EXE "未来备忘录.exe"
!define DEVELOPER  "fuuzccc"
!define GITHUB     "github.com/fuuzccc"
!define APP_ID     "FutureMemo"
!ifndef APP_DIR
  !define APP_DIR "dist\win-unpacked"
!endif

Name "${PRODUCT_NAME}"
OutFile "未来备忘录安装包-${PRODUCT_VERSION}.exe"
RequestExecutionLevel user
InstallDir "$LOCALAPPDATA\Programs\${PRODUCT_NAME}"
InstallDirRegKey HKCU "Software\${APP_ID}" "InstallLocation"

; ---------- UI 配色（本体：清爽浅色） ----------
!define CLR_BG      0xF5F6FA
!define CLR_CARD    0xFFFFFF
!define CLR_TEXT    0x23272F
!define CLR_MUT     0x8A91A1
!define CLR_PRIMARY 0x1677FF

; ---------- MUI 初始 ----------
!define MUI_ICON "assets\icon.ico"
!define MUI_UNICON "assets\icon.ico"
!define MUI_ABORTWARNING

; ---------- 变量 ----------
Var InstallModeCustom
Var LaunchCheck

; ---------- 页面顺序 ----------
Page custom welcomeCreate welcomeLeave
Page custom installModeCreate installModeLeave
!define MUI_PAGE_CUSTOMFUNCTION_PRE SkipDirQuick
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
Page custom finishCreate finishLeave

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "SimpChinese"

; ---------- 欢迎页 ----------
Function welcomeCreate
  ; 记录勾选/回退需要，重新进入时清空
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  SetCtlColors $HWNDPARENT "${CLR_TEXT}" "${CLR_BG}"

  ; 品牌标题
  ${NSD_CreateLabel} 12u 16u 100% 26u "${PRODUCT_NAME}"
  Pop $0
  SetCtlColors $0 "${CLR_PRIMARY}" "${CLR_BG}"
  ; 需要大字重，通过默认字体放大：简单加粗标题下方占位

  ${NSD_CreateLabel} 12u 46u 100% 12u "v${PRODUCT_VERSION} · 清单 / 日历 / 目标 一体化规划工具"
  Pop $0
  SetCtlColors $0 "${CLR_TEXT}" "${CLR_BG}"

  ${NSD_CreateLabel} 12u 70u 100% 30u "欢迎安装 ${PRODUCT_NAME}！$\r$\n本程序无需管理员权限，安装后即可开始规划你的每一个目标。"
  Pop $0
  SetCtlColors $0 "${CLR_MUT}" "${CLR_BG}"

  ${NSD_CreateLabel} 12u 108u 100% 18u "点击“下一步”继续。安装后可随时从“设置”卸载本程序。"
  Pop $0
  SetCtlColors $0 "${CLR_MUT}" "${CLR_BG}"
  nsDialogs::Show
FunctionEnd

Function welcomeLeave
FunctionEnd

; ---------- 安装类型选择页 ----------
Function installModeCreate
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  SetCtlColors $HWNDPARENT "${CLR_TEXT}" "${CLR_BG}"

  ${NSD_CreateLabel} 12u 10u 100% 18u "请选择安装方式："
  Pop $0
  SetCtlColors $0 "${CLR_TEXT}" "${CLR_BG}"

  ${NSD_CreateRadioButton} 16u 34u 100% 14u "快速安装（推荐，直接安装到默认位置）"
  Pop $0
  ${NSD_CreateRadioButton} 16u 54u 100% 14u "自定义安装（选择安装位置，未指定文件夹会自动创建）"
  Pop $1

  ${If} $InstallModeCustom == 1
    ${NSD_Check} $1
  ${Else}
    ${NSD_Check} $0
  ${EndIf}
  nsDialogs::Show
FunctionEnd

Function installModeLeave
  ${NSD_GetState} $1 $0
  ${If} $0 == 1
    StrCpy $InstallModeCustom 1
  ${Else}
    StrCpy $InstallModeCustom 0
  ${EndIf}
FunctionEnd

; 快速安装时跳过目录选择页（使用默认位置，文件夹自动创建）
Function SkipDirQuick
  ${If} $InstallModeCustom == 0
    Abort
  ${EndIf}
FunctionEnd

; ---------- 完成页 ----------
Function finishCreate
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  SetCtlColors $HWNDPARENT "${CLR_TEXT}" "${CLR_BG}"

  ${NSD_CreateLabel} 12u 16u 100% 24u "安装完成，感谢使用！"
  Pop $0
  SetCtlColors $0 "${CLR_PRIMARY}" "${CLR_BG}"

  ${NSD_CreateLabel} 12u 52u 100% -36u "感谢你选择 ${PRODUCT_NAME}。$\r$\n愿你把它当作一张未来的地图，一步步把计划变成现实。$\r$\n祝你规划顺利，天天进步！"
  Pop $0
  SetCtlColors $0 "${CLR_TEXT}" "${CLR_BG}"

  ; 开发者信息
  ${NSD_CreateLabel} 12u 118u 60u 12u "开发者"
  Pop $0
  SetCtlColors $0 "${CLR_MUT}" "${CLR_BG}"
  ${NSD_CreateLabel} 74u 118u 120u 12u "${DEVELOPER}"
  Pop $0
  SetCtlColors $0 "${CLR_TEXT}" "${CLR_BG}"

  ${NSD_CreateLabel} 12u 134u 60u 12u "GitHub"
  Pop $0
  SetCtlColors $0 "${CLR_MUT}" "${CLR_BG}"
  ${NSD_CreateLabel} 74u 134u 140u 12u "${GITHUB}"
  Pop $0
  SetCtlColors $0 "${CLR_PRIMARY}" "${CLR_BG}"

  ${NSD_CreateCheckBox} 12u 156u 100% 14u "立即启动 ${PRODUCT_NAME}"
  Pop $LaunchCheck
  ${NSD_Check} $LaunchCheck

  ; 将“下一步”改成“完成”，并禁用“后退”
  GetDlgItem $0 $HWNDPARENT 1
  EnableWindow $0 0
  GetDlgItem $0 $HWNDPARENT 2
  ${NSD_SetText} $0 "完成(&F)"
  nsDialogs::Show
FunctionEnd

Function finishLeave
  ${NSD_GetState} $LaunchCheck $0
  ${If} $0 == 1
    StrCpy $0 "$INSTDIR\${PRODUCT_EXE}"
    ${If} ${FileExists} $0
      ExecShell open '"$0"'
    ${EndIf}
  ${EndIf}
FunctionEnd

; ---------- 安装 ----------
Section "应用文件" SEC_APP
  SetOutPath "$INSTDIR"
  ; 复制整个解包应用（自动创建目标文件夹，含未指定的深层路径）
  File /r "${APP_DIR}\*.*"

  ; 卸载程序
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; 注册表：记录安装位置
  WriteRegStr HKCU "Software\${APP_ID}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\${APP_ID}" "AppVersion" "${PRODUCT_VERSION}"
  ; 注册表：添加/删除程序（用户级）
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "Publisher" "${DEVELOPER}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayIcon" "$INSTDIR\${PRODUCT_EXE}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "NoRepair" 1

  ; 开始菜单与桌面快捷方式
  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
  CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_EXE}"
  CreateShortcut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_EXE}"
SectionEnd

; ---------- 卸载 ----------
Section "Uninstall"
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  RMDir /r "$SMPROGRAMS\${PRODUCT_NAME}"
  RMDir /r "$INSTDIR"

  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}"
  DeleteRegKey HKCU "Software\${APP_ID}"
SectionEnd
