
var localDB = require('./lib/localDB')();
var timer = 0;

function sync() {

    document.getElementById("startButton").setAttribute("class","btn btn-primary active");
    document.getElementById("result").innerHTML = "Sync Started at " + new Date().toDateString();
    localDB.sync(function(status) {
        if(status) {
            document.getElementById("result").innerHTML = "Sync Successful, Database up to date!";
        }
        else{
            document.getElementById("result").innerHTML = "Syncing Error, Check Logs for details!";
        }
    });
    timer = setTimeout("sync()",30000);
}

function stopSync() {
    document.getElementById("startButton").setAttribute("class","btn btn-primary");
    document.getElementById("result").innerHTML = "Sync Stopped at " + new Date().toDateString();
    if(timer) {
        clearTimeout(timer);
        timer = 0;
    }
}

function showRecords(record) {

 var html = "";
    var ct = 1;
    var db;
    if(record!=null) db = record;
    else db = document.getElementById("selecteddb").value;
    localDB.findData(db,{"all" : "true"},function(st,result) {
        if(st) {
        html += "<div class='row'>" +
            "<div class='col-md-7'><h2>Records</h2></div>" +
            "<div class='col-md-5'>" +
            "<button type='button' class='btn btn-primary' onclick='showRecords()'>Refresh</button>" +
            "&nbsp;<button type='button' class='btn btn-info' onclick='showInsert()'>Insert</button>" +
            "</div></div>";
        result.forEach(function(record) {
                var k = Object.keys(record);
                html += "<div class='well'>";
                html += "<h4>Record " + ct + "</h4>";
                k.forEach(function(key) {
                  html += "<p><strong>" + key + "</strong> : " + record[key] +"</p>";
                })
            html += "</div>";
            html += "<hr>";
            ct++;
            });

        } else {
            html += "<p class='text-warning'>Sorry, No Records found!</p>";

        }
        document.getElementById("table").innerHTML = html;
    })

}

function isOnline() {

    if(navigator.onLine) {
        document.getElementById("isonline").innerHTML = "<h3 class='text-success'><strong>Online</strong></h3>";
    }
    else {
        document.getElementById("isonline").innerHTML = "<h3 class='text-danger'><strong>Offline</strong></h3>";
    }
    setTimeout("isOnline()",1000);
}

function serverReachable() {
    var x = new ( window.ActiveXObject || XMLHttpRequest )( "Microsoft.XMLHTTP" ),
        s;
    x.open(
        "GET",
        "//developer.yahooapis.com/TimeService/V1/getTime?appid=9Zn9qarV34FHsl4WPAJvpDzeT8a8j9wZkyjvOXxssx67Nk5yecYwsQFjy57ZcPZSC2oa8zgB6BJeFa7SpGQn6pR2&output=json",
        false
    );
    try {
        x.send();
        s = x.status;
        return ( s >= 200 && s < 300 || s === 304 );
       } catch (e) {
        console.log(e);
        return false;
    }
}

isOnline();

function showInsert() {
    var html = "";
    var db = document.getElementById("selecteddb").value;
    html += "<h1>Inserting into Collection " + db + "</h1>";
    html += "<div class='row'><div class='col-md-8'><textarea class='form-control' id='jsondata' rows='5'></textarea></div>" +
        "<div class='col-md-4'><button type='button' class='btn btn-primary' onclick='insertRecord()'>Save</button> </div></div>";
    document.getElementById("table").innerHTML = html;
}

function IsJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

function insertRecord() {
    var collection = document.getElementById("selecteddb").value;
    var json = document.getElementById("jsondata").value;
    if(IsJsonString(json)) {
        console.log("JSON OK");
        console.log(collection + ", " + JSON.parse(json));
        localDB.addData(collection,JSON.parse(json));
        document.getElementById("myModalLabel").innerHTML = "Data added successfully";
        document.getElementById("myModalBody").innerHTML = "Data " + json + " added";

        $('#myModal').on('hide.bs.modal',function(e) {
            window.location.reload();
        }).modal();
    }else{
        console.log("JSON not ok");
        document.getElementById("myModalLabel").innerHTML = "Malformed JSON";
        document.getElementById("myModalBody").innerHTML = "Please format the input as correct JSON";
        $('#myModal').modal();
    }
}