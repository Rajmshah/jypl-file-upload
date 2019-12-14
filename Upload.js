const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const async = require("async");
const xlsx = require("node-xlsx").default;
const _ = require("lodash");
const Jimp = require("jimp");
const md5 = require("md5");
var schema = new Schema({
  name: {
    type: String,
    index: true
  },
  size: {
    type: Number
  },
  storageName: {
    type: String,
    index: true
  },
  location: {
    type: String,
    index: true
  },
  downloadLink: {
    type: String,
    index: true
  },
  sizes: [
    {
      width: {
        type: String,
        index: true
      },
      height: {
        type: String,
        index: true
      },
      style: {
        type: String,
        index: true
      },
      storageName: {
        type: String,
        index: true
      }
    }
  ]
});

module.exports = mongoose.model("Upload", schema);
var model = {
  convertUploadObj: function(uploadObject) {
    var obj = {
      name: uploadObject.name,
      size: uploadObject.size,
      storageName: uploadObject.name,
      location:
        "https://storage.googleapis.com/" +
        uploadObject.bucket +
        "/" +
        uploadObject.name,
      downloadLink: uploadObject.mediaLink
    };
    return obj;
  },
  findFile: function(fileObj, callback) {
    var obj;
    if (fileObj.file.indexOf(".") > 0) {
      obj = {
        name: fileObj.file
      };
    } else {
      obj = {
        _id: fileObj.file
      };
    }
    if (fileObj || fileObj.file) {
      Upload.findOne(obj, function(err, data) {
        if (err || _.isEmpty(data)) {
          callback(err);
        } else {
          if (fileObj.width || fileObj.height) {
            Upload.generateFile(data, fileObj, callback);
          } else {
            callback(null, data);
          }
        }
      });
    }
  },
  generateFile: function(data, fileObj, callback) {
    var resizeVal = {};
    if (fileObj.width && !_.isNaN(parseInt(fileObj.width))) {
      resizeVal.width = parseInt(fileObj.width);
    } else {
      resizeVal.width = Jimp.AUTO;
      fileObj.width = 0;
    }
    if (fileObj.height && !_.isNaN(parseInt(fileObj.height))) {
      resizeVal.height = parseInt(fileObj.height);
    } else {
      resizeVal.height = Jimp.AUTO;
      fileObj.height = 0;
    }
    if (
      (fileObj.style == "cover" ||
        fileObj.style == "scaleToFit" ||
        fileObj.style == "resize") &&
      fileObj.width &&
      !_.isNaN(parseInt(fileObj.width)) &&
      fileObj.height &&
      !_.isNaN(parseInt(fileObj.height))
    ) {
      resizeVal.style = fileObj.style;
    } else {
      resizeVal.style = "contain";
      fileObj.style = "contain";
    }
    var finalObject = _.find(data.sizes, function(size) {
      return (
        size.width == fileObj.width &&
        size.height == fileObj.height &&
        size.style == fileObj.style
      );
    });
    if (finalObject) {
      callback(null, finalObject);
    } else {
      Jimp.read(data.location, function(err, image) {
        if (err) {
          callback(err);
        } else if (image) {
          image[resizeVal.style](resizeVal.width, resizeVal.height)
            .quality(60)
            .getBuffer(Jimp.MIME_PNG, function(err, buffer) {
              fileObj.storageName =
                md5(JSON.stringify(fileObj)) + data.storageName;
              var file = storage
                .bucket(storageBucket)
                .file(fileObj.storageName);
              var wstream = file.createWriteStream({
                metadata: {
                  contentType: Jimp.MIME_PNG
                },
                public: true
              });
              wstream.write(buffer);
              wstream.end();
              wstream.on("finish", function() {
                data.sizes.push(fileObj);
                data.save();
                callback(null, fileObj);
              });
            });
        }
      });
    }
  },
  import: function(name) {
    var jsonExcel = xlsx.parse(name);
    var retVal = [];
    var firstRow = _.slice(jsonExcel[0].data, 0, 1)[0];
    var excelDataToExport = _.slice(jsonExcel[0].data, 1);
    var dataObj = [];
    _.each(excelDataToExport, function(val, key) {
      dataObj.push({});
      _.each(val, function(value, key2) {
        dataObj[key][firstRow[key2]] = value;
      });
    });
    return dataObj;
  },
  uploadFindOne: function(filename, callback) {
    Upload.findOne(
      {
        _id: filename
      },
      function(err, data) {
        if (err || _.isEmpty(data)) {
          callback({
            error: "no data found"
          });
        } else {
          callback(data);
        }
      }
    );
  },
  importGS: function(filename, callback) {
    console.log(filename);
    async.waterfall(
      [
        function(callback) {
          const { Storage } = require("@google-cloud/storage");
          var projectId = "tough-star-221919";
          var storage = new Storage({
            projectId: projectId,
            keyFilename: global.keyFilename
          });
          Upload.uploadFindOne(filename, function(uploadData) {
            // console.log("enter", uploadData);
            if (!uploadData.error) {
              //   console.log("entering", uploadData);
              var bucket = storage.bucket(global.storageBucket);
              var readstream = bucket
                .file(uploadData.storageName)
                .createReadStream();
              //   console.log("enters", readstream);
              readstream.on("error", function(err) {
                // console.log("error", err);
                callback({
                  value: false,
                  error: err
                });
              });
              var buffers = [];
              readstream.on("data", function(buffer) {
                buffers.push(buffer);
                // console.log("data", buffers);
              });
              readstream.on("end", function() {
                var buffer = Buffer.concat(buffers);
                // console.log("buffer", buffers);
                callback(null, Upload.import(buffer));
              });
            } else {
              callback(null, "Not found");
            }
          });
        }
      ],
      function(err, complete) {
        if (err) {
          callback(err, null);
        } else {
          callback(null, complete);
        }
      }
    );
  }
};

module.exports = _.assign(module.exports, exports, model);
const Upload = module.exports;
