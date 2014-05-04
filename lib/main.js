
var localDB = require('./lib/localDB')();
var timer = 0;

function sync() {

    document.getElementById("result").innerHTML = "Sync Started at " + new Date().toDateString();
    localDB.sync();
    timer = setTimeout("sync()",30000);
}

function stopSync() {
    document.getElementById("result").innerHTML = "Sync Stopped at " + new Date().toDateString();
    if(timer) {
        clearTimeout(timer);
        timer = 0;
    }
}

function showRecords() {

 var html = "";
    var ct = 1;
    var db = document.getElementById("selecteddb").value;
    localDB.findData(db,{"all" : "true"},function(st,result) {
        if(st) {
        html += "<h2>Records</h2>";
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

}
