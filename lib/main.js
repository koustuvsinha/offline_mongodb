/**
 * Created by Koustuv Sinha & Hitesh Agarwal on 1/5/14.
 */

//---------indexed db global support-----------------------------------------------------------------------

window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction;
window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;

//----------------------------------------------------------------------------------------------------------
var localDB = null;
if (!window.indexedDB) {
    window.alert("Your browser doesn't support a stable version of IndexedDB. So the features of Offline MongoDB will not be available.");
}
else {
 localDB = require('./lib/localDB')();
}
var timer = 0;

function sync() {
    var _ = require('./lib/lodash');
    document.getElementById("startButton").setAttribute("class","btn btn-primary active");
    document.getElementById("result").innerHTML = "Sync Started at " + new Date().toDateString();
    localDB.sync(function(status,msg) {
        if(status) {
            if((msg!=null)&&(_.isEqual(msg,{"conflict" : "yes"}))) {
                document.getElementById("result").innerHTML = "Sync Successful, Database up to date, but with conflicts!";
                document.getElementById("conflict").innerHTML = "<button class='btn btn-primary' onclick='showConflicts()'>Show Conflicts</button> "
            }else{
                document.getElementById("result").innerHTML = "Sync Successful, Database up to date!";
                document.getElementById("conflict").innerHTML = "";
            }
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
            "&nbsp;<button type='button' class='btn btn-info' onclick='showInsert()'>Insert</button>";
        html +="</div></div>";
        result.forEach(function(record) {
                var k = Object.keys(record);
                html += "<div class='well'>";
                html += "<h4>Record " + ct + "</h4>";
                html += "<div class='row'><div class='col-md-10'>";
                k.forEach(function(key) {
                  html += "<p><strong>" + key + "</strong> : " + record[key] +"</p>";
                })
                html += "</div><div class='col-md-2'><button type='button' class='btn btn-primary' onclick=showEdit('"+ record._id +"')>Edit</button>" +
                    "&nbsp;<button type='button' class='btn btn-danger' onclick=showDelete('"+ record._id +"')>Delete</button></div></div>";
            html += "</div>";
            html += "<hr>";
            ct++;
            });

        } else {
            html += "<p class='text-warning'>Sorry, No Records found! &nbsp;<button type='button' class='btn btn-info' onclick='showInsert()'>Insert</button></p>";

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

function showEdit(id) {
    var html = "";
    var db = document.getElementById("selecteddb").value;
    html += "<h1>Editing Document " + id + "</h1>";
    localDB.findData(db,{"_id" : id},function(st,record) {
        if(st) {
            html += "<div class='row'><div class='col-md-8'><textarea class='form-control' id='jsondata' rows='5'>"+ JSON.stringify(record) +"</textarea></div>" +
                "<div class='col-md-4'><button type='button' class='btn btn-primary' onclick=editRecord('"+ id +"')>Save</button> </div></div>";
            document.getElementById("table").innerHTML = html;
        }
    })

}

function editRecord(id) {
    var collection = document.getElementById("selecteddb").value;
    var json = document.getElementById("jsondata").value;
    if(IsJsonString(json)) {
        console.log("JSON OK");

        localDB.updateData(collection,JSON.parse(json),{"_id" : id},function(st) {
            if(st) {
                document.getElementById("myModalLabel").innerHTML = "Data updated successfully";
                document.getElementById("myModalBody").innerHTML = "Data " + json + " updated";
            }else{
                document.getElementById("myModalLabel").innerHTML = "Data update error";
                document.getElementById("myModalBody").innerHTML = "Data " + json + " updating error. Check Logs";
            }
        });

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

function showDelete(id) {
    var html = "";
    var db = document.getElementById("selecteddb").value;
    html += "<h1>Are you sure you want to delete document " + id + "</h1>";
    localDB.findData(db,{"_id" : id},function(st,record) {
        if(st) {
            html += "<div class='row'><div class='col-md-8'><div class='well'>"+ JSON.stringify(record) +"</div></div></div><div class='row'>"+
                "<div class='col-md-4'><button type='button' class='btn btn-primary' onclick=deleteRecord('"+ id +"')>Delete</button>" +
                "&nbsp;<button type='button' class='btn' onclick=showCancel()>Cancel</button> </div></div>";
            document.getElementById("table").innerHTML = html;
        }
    })
}

function showCancel() {
    window.location.reload();
}

function deleteRecord(id) {
    var collection = document.getElementById("selecteddb").value;
    localDB.deleteData(collection,{"_id" : id},function(st) {
        if(st) {
            document.getElementById("myModalLabel").innerHTML = "Data deleted successfully";
            document.getElementById("myModalBody").innerHTML = "Data with id " + id + " deleted successfully";
        }
        else{
            document.getElementById("myModalLabel").innerHTML = "Data deletion error";
            document.getElementById("myModalBody").innerHTML = "Data with id " + id + " deleting error. Check Logs";
        }
    })
    $('#myModal').on('hide.bs.modal',function(e) {
        window.location.reload();
    }).modal();
}

function showConflicts() {
    var html = "";
    var _ = require('./lib/lodash');
    localDB.getAllConflicts(function(st,data) {
        if(st) {
            var ct = 0;
            html += "<div class='row'>" +
                "<div class='col-md-7'><h2>Records</h2></div>" +
                "<div class='col-md-5'>" +
                "<em>These are the flagged conflicts. Make your decision</em>" +
                "</div></div>";
            data.forEach(function(conflict) {
                ct++;
                html += "<h4>Record " + ct + "</h4>";
                html += "<div class='well'>";
                html += "<div class='row'><div class='col-md-10'>";
                var new_up = Object.keys(conflict.data);
                var old_up = Object.keys(conflict.old);
                new_up.forEach(function(key) {
                    html += "<p><strong>" + key + "</strong> : " + conflict.data[key] +"</p>";
                });
                html +="</div><div class='col-md-2'><strong><em>Your Update</em></strong></div></div></div>";
                html += "<div class='well'>";
                html += "<div class='row alert alert-danger'><div class='col-md-10'>";
                old_up.forEach(function(key) {
                    html += "<p><strong>" + key + "</strong> : " + conflict.old[key] +"</p>";
                })
                html +="</div><div class='col-md-2'><strong><em>Conflict</em></strong></div></div></div>";
                html += "<div class='row'><div class='col-md-9'><h1>Manual Merge</h1>" +
                    "<textarea class='form-control' id='"+ conflict.timeStamp +"' rows='5'>"+ JSON.stringify(_.omit(conflict.data,["_id","timeStamp"])) + JSON.stringify(_.omit(conflict.old,["_id","timeStamp"])) +"</textarea></div>" +
                    "<div class='col-md-2'><strong><em>Manual Merge</em></strong></div></div>"
                html += "<div class='row'><div class='col-md-5'><button class='btn btn-primary' onclick=resolveData(" + conflict.timeStamp +",2)>Keep your update</button>" +
                    "&nbsp;<button class='btn btn-danger' onclick=resolveData(" + conflict.timeStamp +",1)>Revert to Server Value</button>" +
                    "&nbsp;<button class='btn btn-info' onclick=resolveData(" + conflict.timeStamp +",3)>Manual Merge</button></div></div>";
                html += "<hr/>";
            })
            document.getElementById("table").innerHTML = html;
        }
    })
}

function resolveData(id,action) {
    var merge = document.getElementById(id.toString()).value;
    if(action!=3) {
        localDB.resolveConflict(id,action,null,function(st) {
            if(st) {
                document.getElementById("myModalLabel").innerHTML = "Conflict resolved successfully";
                document.getElementById("myModalBody").innerHTML = "Conflict resolved successfully";
            }

        });
    }
    else{
        if(IsJsonString(merge)) {
            localDB.resolveConflict(id,action,JSON.parse(merge),function(st) {
                if(st) {
                    document.getElementById("myModalLabel").innerHTML = "Conflict resolved successfully";
                    document.getElementById("myModalBody").innerHTML = "Conflict resolved successfully";
                }

            });
        }else{
            document.getElementById("myModalLabel").innerHTML = "Malformed JSON";
            document.getElementById("myModalBody").innerHTML = "Please format the input as correct JSON";
        }
    }
    $('#myModal').on('hide.bs.modal',function(e) {
        window.location.reload();
    }).modal();
}

function showConflictButton() {
    localDB.getAllConflicts(function(sta,dat) {
        if(sta) {
            document.getElementById("conflict").innerHTML = "<button class='btn btn-primary' onclick='showConflicts()'>Show Conflicts</button> ";
        }
        else{
            document.getElementById("conflict").innerHTML = "";
        }
    })
}

showConflictButton();