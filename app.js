const express = require("express");
const fileUpload = require("express-fileupload");
const app = express();
const async = require("async");
const _ = require("lodash");
const fs = require("fs");
var cors = require("cors");

// default options
var corsOptions = {
  origin: true,
  credentials: true
};
app.use(cors(corsOptions));
app.use(
  fileUpload({
    limits: {
      fileSize: 5 * 1024 * 1024
    }
  })
);

const gCloudKey = "./storage.json";
const { Storage } = require("@google-cloud/storage");
global.storage = new Storage({
  keyFilename: gCloudKey
});
const bucketName = "mtc-mcup";
global.storageBucket = bucketName;

// Mongoose Globals
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

mongoose.connect(
  "mongodb://localhost:27017/mtc?readPreference=primary",
  {
    readPreference: "secondaryPreferred",
    connectTimeoutMS: 600000,
    socketTimeoutMS: 600000,
    useNewUrlParser: true,
    useUnifiedTopology: true
  },
  function(err, data) {
    if (err) {
      // 104.155.238.145
      console.log(err);
    } else {
      console.log("Database Connected to MTC");
      // setupGFS();
    }
  }
);

const Upload = require("./Upload");

app.post("/api/upload/", function(req, res) {
  if (!req.files) return res.status(400).send("No files were uploaded.");

  // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
  let file = req.files.file;
  var originalFilename = file.name;
  var extension = _.last(_.split(originalFilename, "."));
  const filename = "./upload/" + ObjectId() + "." + extension;
  // Use the mv() method to place the file somewhere on your server
  file.mv(filename, function(err) {
    storage
      .bucket(bucketName)
      .upload(filename, {
        // Support for HTTP requests made with `Accept-Encoding: gzip`
        gzip: true,
        metadata: {
          cacheControl: "public, max-age=31536000",
          public: true
        }
      })
      .then(data => {
        const fileData = data[1];
        var uploadObj = Upload(Upload.convertUploadObj(fileData));
        uploadObj.save(function(err, data) {
          res.json({
            data: [data._id],
            value: true
          });
          fs.unlink(filename, function() {});
        });
      })
      .catch(err => {
        res.json({
          error: err,
          value: false
        });
      });
  });
});

app.get("/api/upload/readFile", function(req, res) {
  var width;
  var height;
  if (req.query.width) {
    width = parseInt(req.query.width);
    if (_.isNaN(width)) {
      width = undefined;
    }
  }
  if (req.query.height) {
    height = parseInt(req.query.height);
    if (_.isNaN(height)) {
      height = undefined;
    }
  }
  Upload.findFile(req.query, function(err, data) {
    if (err || _.isEmpty(data)) {
      res.json(err);
    } else {
      res.redirect(
        "https://storage.googleapis.com/" +
          storageBucket +
          "/" +
          data.storageName
      );
    }
  });
});

app.get("/", function(req, res) {
  res.send("MTC File Upload");
});
app.listen(1330);
