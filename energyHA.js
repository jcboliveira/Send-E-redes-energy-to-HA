const sendToHA1 = require("./sendenergyHA")
const fs = require('fs')
const csv = require('csvtojson')
XLSX = require('xlsx');

var Hours =0;
var host ="";
var token ="";
 
process.argv.forEach(function (val, index, array) {
    for (var i=0;i<array.length;++i) {
        if (array [i]=="--i")
            host=array [i+1];
        if (array [i]=="--t")
            token=array [i+1];
        if (array [i]=="--h")
            Hours=array [i+1];
    }
});


const dir = fs.opendirSync('.')
let dirent

var files_in = [];
files_in = fs.readdirSync('./');
files_in = files_in.sort()
files_in.forEach(element => {
    var nameTemp = element;
    if (element.substring(element.length - 4, element.length) == 'xlsx') {

        const workBook = XLSX.readFile(nameTemp);
        const CVSFile = nameTemp.substring(0, nameTemp.length - 4);
        XLSX.writeFile(workBook, CVSFile + 'csv', { bookType: "csv" });


        fs.readFile(CVSFile + 'csv', 'utf8', function (err, data) {

            if (err) {
                return console.log(err);
            }

            for (i = 0; i < 8; ++i) {
                data = data.split("\n").slice(1).join("\n")
            }

            data = data.replace(RegExp('/', 'g'), '-');

            var regex = /.*-.*-.*,/g, result, dates = [], values = [], values = [];

            while ((result = regex.exec(data))) {
                data = data.replaceAt(result.index + 10, 'T');
            }
            csv({
                noheader: true,
                output: "csv"
            })
                .fromString(data)
                .then((csvRow) => {
                    var t = 0, j = 0;
                    var temp = 0.0;
                    var jsonDataVar = [];
                    var dateTemp = new Date(csvRow[0][0]);
                    var initDate = new Date(dateTemp.setMinutes(dateTemp.getMinutes() - 15 - 60- 60*Hours)).toISOString()

                    // var Init = new Date(csvRow [0][0]).toISOString();
                    var dateAnt = new Date().now;
                    for (i = 0; i < csvRow.length; ++i) {
                        temp = temp + Number(csvRow[i][1]);
                        var date = new Date(csvRow[i][0]);
                        date = new Date(date.setHours(date.getHours() - 1));
                        var dateISOString = date.toISOString()
                        let minutes = date.getMinutes();

                        if (minutes == 0) {
                            if (dateAnt != date) {
                                dateAnt = date;
                                var dataEnergy = {
                                    start: dateISOString,
                                    sum: temp
                                };
                                jsonDataVar.push(dataEnergy)
                                t = 0;
                            }
                        }

                        ++t;

                    }
                    console.log('Data inicial:' + initDate);
                    sendToHA1.sendToHA(jsonDataVar, initDate, host,token);

                })
        });
    }
})
dir.close();

String.prototype.replaceAt = function (index, replacement) {
    return this.substring(0, index) + replacement + this.substring(index + replacement.length);
}
