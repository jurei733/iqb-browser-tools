// Runs the unchanged Toolbox assembly in a dedicated x86/x64 test process.
// Per-executable Windows-on-Arm precision settings apply only to this harness.
using System;
using System.IO;
using System.Reflection;
using System.Globalization;
using System.Security.Cryptography;
using System.Runtime.InteropServices;
using System.Linq;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

public class WindowsPrecisionReference {
 static string toolPath;
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool IsWow64Process2(IntPtr process,out ushort processMachine,out ushort nativeMachine);
 static string Hash(string path) { using(var sha=SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(path))).Replace("-", "").ToLowerInvariant(); }
 public static int Main(string[] args) {
  toolPath=Path.Combine(args[0],"originals","itc-ToolBox");
  AppDomain.CurrentDomain.AssemblyResolve+=(sender,e)=>{var path=Path.Combine(toolPath,new AssemblyName(e.Name).Name+".dll");return File.Exists(path)?Assembly.LoadFrom(path):null;};
  try { Capture(args); return 0; } catch(Exception e) { File.WriteAllText(args[2]+".error.txt",e.ToString()); return 1; }
 }
 static void Capture(string[] args) {
  System.Threading.Thread.CurrentThread.CurrentCulture=CultureInfo.GetCultureInfo("de-DE");
  var tool=Assembly.LoadFrom(Path.Combine(toolPath,"itc-Toolbox.exe"));
  var tests=JArray.Parse(File.ReadAllText(args[1]));var results=new JArray();
  foreach(var test in tests) {
   var result=new JObject();result["id"]=(string)test["id"];
   try {
    var method=(string)test["method"];var content=(string)test["contentJSON"];
    var m=tool.GetType("iqb.testcenter.toolbox.UnitLineDataResponses").GetMethod(method,BindingFlags.NonPublic|BindingFlags.Static);
    var values=method=="setResponsesIqbStandard"||method=="setResponsesAbi"?new object[]{content}:new object[]{content,null};
    result["outputJSON"]=JsonConvert.SerializeObject(m.Invoke(null,values));
   } catch(Exception e) { while(e.InnerException!=null)e=e.InnerException;result["exceptionType"]=e.GetType().FullName;result["message"]=e.Message; }
   try {
    var probes=new JArray();foreach(var value in JToken.Parse((string)test["contentJSON"]).SelectTokens("$..*").OfType<JValue>().Where(v=>v.Type==JTokenType.Float)){
     var number=(double)value.Value;var p=new JObject();p["path"]=value.Path;p["bits"]=BitConverter.DoubleToInt64Bits(number).ToString("x16");p["g15"]=number.ToString("G15",CultureInfo.InvariantCulture);p["g17"]=number.ToString("G17",CultureInfo.InvariantCulture);p["roundTrip"]=number.ToString("R",CultureInfo.InvariantCulture);probes.Add(p);
    }result["doubleProbes"]=probes;
   } catch { /* Diagnostic parsing cannot change the original converter outcome. */ }
   results.Add(result);
  }
  var report=new JObject();report["finished"]=DateTime.UtcNow.ToString("o");report["processBits"]=IntPtr.Size*8;report["processArchitecture"]=Environment.GetEnvironmentVariable("PROCESSOR_ARCHITECTURE");report["platform"]=Environment.OSVersion.VersionString;report["runtime"]=Environment.Version.ToString();report["timezone"]=TimeZoneInfo.Local.Id;report["culture"]=CultureInfo.CurrentCulture.Name;
  ushort processMachine,nativeMachine;
  if(!IsWow64Process2(System.Diagnostics.Process.GetCurrentProcess().Handle,out processMachine,out nativeMachine))throw new System.ComponentModel.Win32Exception();
  report["processMachine"]=processMachine.ToString("x4");report["nativeMachine"]=nativeMachine.ToString("x4");
  report["precisionProfile"]=args[3];report["harnessSHA256"]=Hash(Assembly.GetExecutingAssembly().Location);report["inputSHA256"]=Hash(args[1]);report["assemblySHA256"]=Hash(Path.Combine(toolPath,"itc-Toolbox.exe"));report["results"]=results;
  if(args.Length>4){
   var pipelines=JArray.Parse(File.ReadAllText(args[4]));var outputs=new JArray();
   foreach(var test in pipelines){var entry=new JObject();entry["id"]=(string)test["id"];try{
    var dto=JsonConvert.DeserializeObject(test["dto"].ToString(Formatting.None),tool.GetType("iqb.testcenter.toolbox.ResponseDTO"));
    var output=tool.GetType("iqb.testcenter.toolbox.UnitLineDataResponses").GetMethod("fromTestcenterAPI").Invoke(null,new object[]{dto});entry["outputJSON"]=JsonConvert.SerializeObject(output);
   }catch(Exception e){while(e.InnerException!=null)e=e.InnerException;entry["exceptionType"]=e.GetType().FullName;entry["message"]=e.Message;}outputs.Add(entry);}
   report["pipelineResults"]=outputs;report["pipelineInputSHA256"]=Hash(args[4]);
  }
  File.WriteAllText(args[2],report.ToString(),new System.Text.UTF8Encoding(false));
 }
}
