// node basics.js --excel=Worldcup.csv --dataDir=worldcup --source=https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results


let minimist = require("minimist");
let axios = require("axios");
let jsdom = require("jsdom");
let excel4node = require("excel4node");
let pdf = require("pdf-lib");
let fs = require("fs");
let path = require("path");
const { rgb } = require("pdf-lib");
let args = minimist(process.argv);

//download using axios and read using jsdom
let responsePromise=axios.get(args.source);
responsePromise.then(function(response){
    let matches=[];
    let html=response.data;
    let dom=new jsdom.JSDOM(html);
    let document=dom.window.document;
    let matchScoreDivs=document.querySelectorAll("div.match-score-block");
    for(let i=0;i<matchScoreDivs.length;i++)
    {
        let match={
            t1:" ",
            t2:" ",
            t1s:" ",
            t2s:" ",
            result:" "
        };
        let nameps=matchScoreDivs[i].querySelectorAll("div.name-detail > p.name");
        match.t1=nameps[0].textContent;
        match.t2=nameps[1].textContent;
        let Scorespans=matchScoreDivs[i].querySelectorAll("div.score-detail > span.score");
        if(Scorespans.length==2)
        {
            match.t1s=Scorespans[0].textContent;
            match.t2s=Scorespans[1].textContent;
        }
        else if(Scorespans.length==1)
        {
            match.t1s=Scorespans[0].textContent;
            match.t2s=" ";
        }
        else
        {
            match.t1s=" ";
            match.t2s=" ";
        }
        let spanresult=matchScoreDivs[i].querySelector("div.status-text > span");
        match.result=spanresult.textContent;
        matches.push(match);
    }
    let matchesJson=JSON.stringify(matches);
    fs.writeFileSync("matches.json",matchesJson,"utf-8");
    let teams=[];
    for(let i=0;i<matches.length;i++)
    {
        pushTeam(teams,matches[i].t1);
        pushTeam(teams,matches[i].t2);
    }
    for(let i=0;i<matches.length;i++)
    {
        addMatch(teams,matches[i].t1,matches[i].t2,matches[i].t1s,matches[i].t2s,matches[i].result);
        addMatch(teams,matches[i].t2,matches[i].t1,matches[i].t2s,matches[i].t1s,matches[i].result);
    }
    let teamskajson=JSON.stringify(teams);
    fs.writeFileSync("teams.json",teamskajson,"utf-8");
    prepareExcel(teams,args.excel);
    preparePdf(teams,args.dataDir);
}).catch(function(err){
    console.log(err);
})
function pushTeam(teams,teamName)
{
    let tidx=-1;
    for(let i=0;i<teams.length;i++)
    {
        if(teams[i].name==teamName)
        {
            tidx=i;
            break;
        }
    }
    if(tidx==-1)
    {
        teams.push({
            name:teamName,
            matches:[]
        })
    }
}
function addMatch(teams,homeTeam,OppTeam,SelfScore,OppScore,result)
{
    let tidx=-1;
    for(let i=0;i<teams.length;i++)
    {
        if(teams[i].name==homeTeam)
        {
            tidx=i;
            break;
        }
    }
    let team=teams[tidx];
    team.matches.push({
        vs:OppTeam,
        SelfScore:SelfScore,
        OppScore:OppScore,
        result:result
    })
}

// making excel using excel4node
function prepareExcel(teams,excelFileName)
{
    let wb=new excel4node.Workbook();
    for(let i=0;i<teams.length;i++)
    {
        let tsheet=wb.addWorksheet(teams[i].name);
        tsheet.cell(1,1).string("Vs");
        tsheet.cell(1,2).string("Self score");
        tsheet.cell(1,3).string("Opponent score");
        tsheet.cell(1,4).string("Result");
        for(let j=0;j<teams[i].matches.length;j++)
        {
            tsheet.cell(2+j,1).string(teams[i].matches[j].vs);
            tsheet.cell(2+j,2).string(teams[i].matches[j].SelfScore);
            tsheet.cell(2+j,3).string(teams[i].matches[j].OppScore);
            tsheet.cell(2+j,4).string(teams[i].matches[j].result);  
        }
    }
    wb.write(args.excel);
}

// converting it to pdf using pdf-lib
function preparePdf(teams,dataDir)
{
    if(fs.existsSync(dataDir)==true)
    {
        fs.rmdirSync(dataDir,{recursive:true});
    }
    fs.mkdirSync(args.dataDir);
    for(let i=0;i<teams.length;i++)
    {
        let teamFolderName= path.join(args.dataDir,teams[i].name);
        if(fs.existsSync(teamFolderName)==false)
        {
            fs.mkdirSync(teamFolderName);
        }
        for(let j=0;j<teams[i].matches.length;j++)
        {
            let matchFileName=path.join(teamFolderName,teams[i].matches[j].vs);
            createScoreCard(teams[i].name,teams[i].matches[j],matchFileName);
        }
    }
}
function createScoreCard(homeTeam,match,matchFileName)
{
    let templateFileBytes=fs.readFileSync("Template.pdf");
    let pdfdocPromise=pdf.PDFDocument.load(templateFileBytes);
    pdfdocPromise.then(function(pdfdoc){
        let page=pdfdoc.getPage(0);
        page.drawText(homeTeam,{
            x:215,
            y:686,
            size:12,
            color:rgb(0.80,0.2,0.3)
        });
        page.drawText(match.vs,{
            x:215,
            y:669,
            size:12,
            color:rgb(0.95,0.1,0.1)
        });
        page.drawText(match.SelfScore,{
            x:215,
            y:652,
            size:12,
            color:rgb(0.2,0.32,0.14)
        });
        page.drawText(match.OppScore,{
            x:215,
            y:635,
            size:12,
            color:rgb(0.21,0.1,0.32)
        });
        page.drawText(match.result,{
            x:215,
            y:617,
            size:12,
            color:rgb(0.1,0.23,0.89)
        });
        let changedBytesPromise=pdfdoc.save();
        changedBytesPromise.then(function(changedBytes){
           if(fs.existsSync(matchFileName + ".pdf")==true)
           {
              fs.writeFileSync(matchFileName+"1.pdf",changedBytes);
           }
           else
           {
               fs.writeFileSync(matchFileName+".pdf",changedBytes);
           }
        })
    })
}
