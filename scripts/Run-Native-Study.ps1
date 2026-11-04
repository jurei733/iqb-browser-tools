param([string]$OriginalRoot,[string]$StudyRoot)
$ErrorActionPreference='Stop'
$OriginalRoot=[IO.Path]::GetFullPath($OriginalRoot);$StudyRoot=[IO.Path]::GetFullPath($StudyRoot)
if($env:PROCESSOR_ARCHITECTURE -ne 'AMD64'){throw 'Study reference requires a native x64 Windows host'}
$json=Join-Path $OriginalRoot 'itc-ToolBox\Newtonsoft.Json.dll'
$failed=@()
foreach($study in @('cohort1000','pilot84')){foreach($arch in @('x86','x64')){
 $root=Join-Path $StudyRoot ($study+'\'+$arch)
 if(Test-Path (Join-Path $root 'native.sqlite')){throw 'Refusing to overwrite original database'}
 Copy-Item $json $root
 Copy-Item (Join-Path $OriginalRoot 'itc-ToolBox\itc-Toolbox.exe.config') (Join-Path $root 'study.exe.config')
 $framework=if($arch -eq 'x86'){'Framework'}else{'Framework64'}
 $compiler=Join-Path $env:WINDIR ('Microsoft.NET\'+$framework+'\v4.0.30319\csc.exe')
 & $compiler /nologo ('/platform:'+$arch) ('/out:'+(Join-Path $root 'study.exe')) ('/reference:'+$json) 'scripts\TestcenterStudyReference.cs'
 if($LASTEXITCODE){throw 'Study harness compilation failed'}
 & (Join-Path $root 'study.exe') $OriginalRoot $root
 if($LASTEXITCODE){$failed+=($study+'/'+$arch)}
}}
if($failed.Count){throw ('Native study operations failed: '+($failed -join ', '))}
Write-Output 'Both Testcenter cohorts captured using unchanged x86/x64 Windows originals.'
