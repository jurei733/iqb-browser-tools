using System;
using System.IO;
using System.Linq;
using System.Collections;
using System.Collections.Generic;
using System.Reflection;
using System.Globalization;
using System.Security.Cryptography;
using System.ComponentModel;
using System.Runtime.InteropServices;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
class StudyReference {
 static string originals,root,toolPath;static Assembly tool;static JObject report;static List<object> apiPeople;
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool IsWow64Process2(IntPtr process,out ushort machine,out ushort native);
 static string Hash(string path){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(path))).Replace("-","").ToLowerInvariant();}
 static Type T(string name){return tool.GetType("iqb.testcenter.toolbox."+name,true);}
 static object Call(object target,string method,params object[] args){return target.GetType().GetMethod(method).Invoke(target,args);}
 static object Static(string type,string method,params object[] args){return T(type).GetMethod(method).Invoke(null,args);}
 static IEnumerable Items(object value){return (IEnumerable)value;}
 static void Save(string name,object value){File.WriteAllText(Path.Combine(root,name),JsonConvert.SerializeObject(value),new System.Text.UTF8Encoding(false));}
 static void Step(string name,Action run){try{run();report[name]="passed";}catch(Exception e){while(e.InnerException!=null)e=e.InnerException;report[name]=new JObject(new JProperty("error",e.ToString()));}File.WriteAllText(Path.Combine(root,"native-report.json"),report.ToString());}
 static List<object> People(object list){var result=new List<object>();foreach(var person in Items(list.GetType().GetProperty("Values").GetValue(list,null))){foreach(var b in Items(person.GetType().GetField("booklets").GetValue(person)))Call(b,"setTimestamps");result.Add(person);}return result;}
 static List<object> FromAPI(){var people=Activator.CreateInstance(T("PersonList"));foreach(var pair in new[]{new[]{"existing-responses.json","ResponseDTO","UnitLineDataResponses","AddUnitData"},new[]{"logs-api.json","LogEntryDTO","UnitLineDataLog","AddLogEntry"}}){var type=typeof(List<>).MakeGenericType(T(pair[1]));var data=JsonConvert.DeserializeObject(File.ReadAllText(Path.Combine(root,pair[0])),type);foreach(var row in Items(data))Call(people,pair[3],Static(pair[2],"fromTestcenterAPI",row));}return People(people);}
 static List<object> FromCSV(){
  var people=Activator.CreateInstance(T("PersonList"));int skippedResponses=0,skippedLogs=0;
  foreach(var line in File.ReadLines(Path.Combine(root,"responses.csv")).Skip(1)){
   var unit=Static("UnitLineDataResponses","fromCsvLine",line,";",Enum.Parse(T("CsvResponseFileType"),"Legacy"));
   var forms=unit==null?null:(IList)unit.GetType().GetField("subforms").GetValue(unit);
   if(forms==null||forms.Count==0||((IList)forms[0].GetType().GetField("responses").GetValue(forms[0])).Count==0){skippedResponses++;continue;}
   Call(people,"AddUnitData",unit);
  }
  foreach(var line in File.ReadLines(Path.Combine(root,"logs.csv")).Skip(1)){
   var entry=Static("UnitLineDataLog","fromCsvLine",line,Enum.Parse(T("CsvLogFileType"),"Legacy"));
   // LoadDataFromCsvPage2Result skips null rows returned by the original parser.
   if(entry==null){skippedLogs++;continue;}Call(people,"AddLogEntry",entry);
  }
  report["csvSkippedResponseRows"]=skippedResponses;report["csvSkippedLogRows"]=skippedLogs;return People(people);
 }
 static List<object> ReadDB(string filename){var db=Activator.CreateInstance(T("SQLiteConnector"),new object[]{Path.Combine(root,filename),false});try{var ids=Call(db,"getPeopleList");var result=new List<object>();foreach(var id in Items(ids.GetType().GetProperty("Values").GetValue(ids,null)))result.Add(Call(db,"getPersonResponses",id));return result;}finally{Call(db,"CloseConnection");}}
 [STAThread] static int Main(string[] args){
  originals=args[0];root=args[1];toolPath=Path.Combine(originals,"itc-ToolBox");
  AppDomain.CurrentDomain.AssemblyResolve+=(s,e)=>{foreach(var folder in new[]{toolPath,Path.Combine(originals,"IQB-Kodieren")}){var path=Path.Combine(folder,new AssemblyName(e.Name).Name+".dll");if(File.Exists(path))return Assembly.LoadFrom(path);}return null;};
  try{Run();return report.Properties().Any(p=>p.Value.Type==JTokenType.Object&&p.Value["error"]!=null)?2:0;}catch(Exception e){File.WriteAllText(Path.Combine(root,"fatal.txt"),e.ToString());return 1;}
 }
 static void Run(){
  System.Threading.Thread.CurrentThread.CurrentCulture=CultureInfo.GetCultureInfo("de-DE");System.Threading.Thread.CurrentThread.CurrentUICulture=CultureInfo.GetCultureInfo("de-DE");
  tool=Assembly.LoadFrom(Path.Combine(toolPath,"itc-Toolbox.exe"));
  if(Hash(tool.Location)!="c6da2bb894fcdc5b220f8c8fd222d8fe8da6dbdeafa3e71a55f2afa4878186f1")throw new Exception("Changed Toolbox binary");
  ushort machine,native;if(!IsWow64Process2(System.Diagnostics.Process.GetCurrentProcess().Handle,out machine,out native))throw new Exception("Architecture probe failed");
  report=new JObject(new JProperty("synthetic",true),new JProperty("empiricalStudy",false),new JProperty("started",DateTime.UtcNow.ToString("o")),new JProperty("processBits",IntPtr.Size*8),new JProperty("nativeMachine",native.ToString("x4")),new JProperty("processMachine",machine.ToString("x4")),new JProperty("culture",CultureInfo.CurrentCulture.Name),new JProperty("timezone",TimeZoneInfo.Local.Id),new JProperty("toolboxSHA256",Hash(tool.Location)),new JProperty("codingCommonSHA256",Hash(Path.Combine(originals,"IQB-Kodieren","IQB-Common.dll"))));
  var hashes=new JObject();foreach(var file in new[]{"existing-responses.json","responses.csv","logs.csv","logs-api.json","browser.sqlite","browser.result","blank-native.xlsx"})hashes[file]=Hash(Path.Combine(root,file));report["inputSHA256"]=hashes;
  Step("toolbox-api-import",()=>{apiPeople=FromAPI();Save("native-api-people.json",apiPeople);report["people"]=apiPeople.Count;});
  Step("toolbox-csv-import",()=>{Save("native-csv-people.json",FromCSV());});
  Step("toolbox-read-browser-sqlite",()=>{Save("native-browser-db-people.json",ReadDB("browser.sqlite"));});
  Step("toolbox-write-sqlite",()=>{var path=Path.Combine(root,"native.sqlite");if(File.Exists(path))throw new Exception("Refusing to replace an existing native database");var db=Activator.CreateInstance(T("SQLiteConnector"),new object[]{path,true});try{foreach(var p in apiPeople)Call(db,"addPerson",p);Call(db,"WriteDbInfoData",false);}finally{Call(db,"CloseConnection");}Save("native-own-db-people.json",ReadDB("native.sqlite"));});
  Step("toolbox-excel-export",()=>{Static("globalOutputStore","clear");var data=T("globalOutputStore").GetField("personDataFull").GetValue(null);foreach(var p in apiPeople){var id=String.Concat(new[]{"group","login","code"}.Select(k=>(string)p.GetType().GetField(k).GetValue(p)).ToArray());Call(data,"Add",id,p);}var config=Activator.CreateInstance(T("WriteXlsxConfig"));config.GetType().GetField("targetXlsxFilename").SetValue(config,Path.Combine(root,"native-wide.xlsx"));foreach(var key in new[]{"writeResponsesValues","writeResponsesStatus","writeResponsesCodes","writeResponsesScores"})config.GetType().GetField(key).SetValue(config,true);config.GetType().GetField("subformMode").SetValue(config,Enum.Parse(T("SubformMode"),"Rows"));var worker=new BackgroundWorker();worker.WorkerReportsProgress=true;Static("WriteOutputToXlsx","Write",File.ReadAllBytes(Path.Combine(root,"blank-native.xlsx")),worker,new DoWorkEventArgs(null),config);});
  Step("coding-original-archive-codec",()=>{var path=Path.Combine(originals,"IQB-Kodieren","IQB-Common.dll");if(Hash(path)!="4845bf183b80509f743dc87d6e5b211bd5c9757417a9ff08665278f27fda20a6")throw new Exception("Changed CodingResults library");var common=Assembly.LoadFrom(path);var type=common.GetType("HUBerlin.IQB.Common.ZipXDocProvider");var doc=type.GetMethod("ZipXDocFromFile").Invoke(null,new object[]{Path.Combine(root,"browser.result")});if(doc==null)throw new Exception("Original archive reader rejected browser result");type.GetMethod("ZipXDocToFile").Invoke(null,new object[]{Path.Combine(root,"native-codec.result"),doc});});
  report["finished"]=DateTime.UtcNow.ToString("o");File.WriteAllText(Path.Combine(root,"native-report.json"),report.ToString());
 }
}
