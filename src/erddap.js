const NetCDFReader = require('netcdfjs');
const merge = require('deepmerge').default;
const chrono = require('chrono-node');
const moment = require("moment");
const TIME_CLOSEST_PLACEHOLDER = "TIME_CLOSEST_PLACEHOLDER";

if (!Date.prototype.toISOString2) {
  (function() {

    function pad(number) {
      if (number < 10) {
        return '0' + number;
      }
      return number;
    }

    Date.prototype.toISOString2 = function() {
      return this.getUTCFullYear() +
        '-' + pad(this.getUTCMonth() + 1) +
        '-' + pad(this.getUTCDate()) +
        'T' + pad(this.getUTCHours()) +
        ':' + pad(this.getUTCMinutes()) +
        ':' + pad(this.getUTCSeconds()) +
        'Z';
    };

  }());
}

function time_encoder(value) {
  if(value instanceof Date){
    return "("+value.toISOString2()+")";
  }
  if(value == "closest"){
    return TIME_CLOSEST_PLACEHOLDER;
  }
  if(value == "first"){
    return 0;
  }
  if(value == "last"){
    return value;
  }
  try {
    var m = moment(chrono.parseDate(value));
    if (m.isValid()) {
      m = m.toISOString2();
      if (m) {
        return "("+m+")";
      }
    }
    return value;
  } catch (e) {
    console.log(e);
    return value;
  }
}
var parse_floats = function(parts,err_msg,expected_length){
	if(parts.length != expected_length){
		throw(err_msg);
	}
	var results = [];
	try{
		for(var p=0;p<parts.length;p++){
			results.push(parseFloat(parts[p]));
		}
	}catch(e){
		throw(err_msg);
	}
	return results;
}
var parse_point = function(value){
	var parts = value.split(/[ ,]+/);
	var err_msg = "Expected point to be a string with point coordinates in a 'lng,lat' format, but got '"+value+"'";
	parts = parse_floats(parts,err_msg,2);
	return { lat: parts[1], lon: parts[0]};
}
var parse_bbox = function(value){
	var parts = value.split(/[ ,]+/);
	var err_msg = "Expected bbox to be a string with bounding box coordinates in a 'southwest_lng,southwest_lat,northeast_lng,northeast_lat' format, but got '"+value+"'";
	parts = parse_floats(parts,err_msg,4);
	return {
		lat: {
			min: (parts[1]<parts[3]?parts[1]:parts[3]),
			max: (parts[1]<parts[3]?parts[3]:parts[1])
		},
		lon: {
			min: (parts[0]<parts[2]?parts[0]:parts[2]),
			max: (parts[0]<parts[2]?parts[2]:parts[0])
		}
	}
}
var griddap_url = function(dataset,args,wanted,extents,extension){
	var data_wanted = [];
	var dimensions = {};
	wanted.forEach(function(field){
		if(dataset.dimensions[field]){
			data_wanted.push(field);
			for(var j=0;j<dataset.dimensions[field].length; j++){
				dimensions[dataset.dimensions[field][j]] = dimensions[dataset.dimensions[field][j]] || {min:0,max:"last",stride:1};
			}
		}
	});

	for(var arg in args){
		if( (arg == "since" || arg == "until") && dataset.param_encoder[arg] === time_encoder){
			if(!dimensions[dataset.time_dimension]){
				throw("filtering of time without data not implemented - "+dataset.time_dimension);
			}
			var when = arg == "since" ? "min":"max";
			dimensions[dataset.time_dimension][when] = time_encoder(args[arg]);
			continue;
		}
		if(arg == "bbox"){ //TODO: what if bbox is in the data.
			var bbox = parse_bbox(args[arg]);
			dimensions[dataset.lon_dimension].min = "("+Math.max(extents.lon.min,bbox.lon.min)+")";
			dimensions[dataset.lon_dimension].max = "("+Math.min(extents.lon.max,bbox.lon.max)+")";
			dimensions[dataset.lat_dimension].min = "("+Math.max(extents.lat.min,bbox.lat.min)+")";
			dimensions[dataset.lat_dimension].max = "("+Math.min(extents.lat.max,bbox.lat.max)+")";
			continue;
		}
		if(arg == "point"){ //TODO: what if bbox is in the data.
			var point = parse_point(args[arg]);
			dimensions[dataset.lon_dimension].min = "("+point.lon+")";
			dimensions[dataset.lon_dimension].max = "("+point.lon+")";
			dimensions[dataset.lat_dimension].min = "("+point.lat+")";
			dimensions[dataset.lat_dimension].max = "("+point.lat+")";
			continue;
		}
    if(args[arg] instanceof Date || typeof args[arg] !== 'object'){
      var value = args[arg];
			if(value instanceof Date || arg == "time"){
				value = time_encoder(value);
			}
      if(dimensions[arg]){
        dimensions[arg].min = value;
        dimensions[arg].max = value;
      }else{
        //local_accepts not implemnted
      }
      continue;
    }
		for(var constraint in args[arg]){
			var value = args[arg][constraint];
			if(arg == "time"){
				value = time_encoder(value);
			}
      var field = arg;

			if(dimensions[field]){
				switch(constraint){
					case 'min':
					case 'max':
						dimensions[field][constraint] = value;
						break;
					case 'eq':
						dimensions[field].min = value;
						dimensions[field].max = value;
						break;
					case 'stride':
						break;
					default:
						throw "constraint '"+constraint+"' not recognised for "+field;
				}
			}else{
				var accepts = null;
				var constrained_value = value;
				if(dataset.param_encoder[field]){
					constrained_value = dataset.param_encoder[field](value);
				}
				switch(constraint){
					case 'min':
						accepts = function(field,value,obj){
							return obj[field] >= value;
						}.bind(null,arg,constrained_value)
						break;
					case 'max':
						accepts = function(field,value,obj){
							return obj[field] <= value;
						}.bind(null,arg,constrained_value)
						break;
					case 'eq':
						accepts = function(field,value,obj){
							return obj[field] == value;
						}.bind(null,arg,constrained_value)
						break;
					default:
						throw "constraint '"+constraint+"' not recognised";
				}
				local_accepts.push(accepts);
			}
		}
	}
	var erddap_params = [];
	if(data_wanted.length){
		var constraints = [];
		for(var i=0;i<data_wanted.length;i++){
			var constraint = data_wanted[i];
			var param = constraint;
			if(i == 0){
				wanted = [];
				for(var j=0;j<dataset.dimensions[constraint].length;j++){
					wanted.push(dataset.dimensions[constraint][j]);
				}
			}
			wanted.push(constraint);
			for(var j=0;j<dataset.dimensions[constraint].length;j++){
				var dimension = dimensions[dataset.dimensions[constraint][j]];
				param = param + "["+dimension.min+":"+dimension.stride+":"+dimension.max+"]";
			}
			constraints.push(param);
		}
		erddap_params.push(constraints.join(","));
	}else{
		erddap_params.push(wanted.join(","));
	}
		return url = dataset.base_url+"/griddap/"+dataset.id+(extension.startsWith('.')?"":".")+extension+'?'+erddap_params.join("&");
}
var Erddap = function(base_url) {
  this.base_url = base_url || 'https://upwell.pfeg.noaa.gov/erddap';
  this._datasets = {};
}

var Dataset = function(erddap, dataset_id) {
  this.erddap = erddap;
  this.dataset_id = dataset_id;
  this._dimensions = {};
  var url = this.erddap.base_url + "/info/" + this.dataset_id + "/index.json";
  this._fetchMetadata = fetch(url).then(function(response) {
    if(response.ok){
      return response.json();
    }else{
      throw new Error("Error fetching "+url);
    }
  }).then(function(response) {
    var obj = {};
    for (var i = 0; i < response.table.rows.length; i++) {
      var row = response.table.rows[i];
      obj[row[0]] = obj[row[0]] || {};
      obj[row[0]][row[1]] = obj[row[0]][row[1]] || {};
      obj[row[0]][row[1]][row[2]] = obj[row[0]][row[1]][row[2]] || {};
      obj[row[0]][row[1]][row[2]].type = row[3];
      obj[row[0]][row[1]][row[2]].value = row[4];
    };
    return (obj);
  }).then(function(info) {
    var param_encoder = {};
    var dataset = {
      _fieldnames: []
    };
    var wanted = ["dimension", "variable"];
    for (var x = 0; x < wanted.length; x++) {
      var dimvar = wanted[x];
      if (!info[dimvar]) {
        continue;
      }

      if (dimvar == "dimension") {
        dataset.dimensions = {};
      }

      for (var key in info[dimvar]) {
        dataset._fieldnames.push(key);
        var etype = info[dimvar][key][""]["type"];
        var evalue = "" + info[dimvar][key][""]["value"];
        var gtype = null;
        var atype = null
        switch (etype) {
          case 'float':
          case 'double':
            param_encoder[key] = function(v) {
              return isNaN(v) ? null : v
            };
            break;
          case 'int':
          case 'long':
          case 'short':
          case 'byte':
            param_encoder[key] = function(v) {
              return isNaN(v) ? null : v
            };
            break;
          case 'String':
            param_encoder[key] = function(v) {
              return '"' + v + '"'
            };
            break;
          default:
            throw 'Unknown type [' + etype + '] for ' + dataset.id + '.' + key;
        }

        var isTimeField = false;
        if (info.attribute[key] && info.attribute[key]["_CoordinateAxisType"]) {
          var axisType = info.attribute[key]["_CoordinateAxisType"].value;
          switch (axisType) {
            case "Time":
              dataset.time_dimension = key;
              param_encoder[key] = time_encoder;
              param_encoder['since'] = time_encoder;
              param_encoder['until'] = time_encoder;
              break;
            case "Lat":
              dataset.lat_dimension = key;
              break;
            case "Lon":
              dataset.lon_dimension = key;
              break;
          }
        }

        if (dimvar != "dimension" && info.dimension && evalue) {
          dataset.dimensions[key] = evalue.split(/[ ,]+/);
        }

        if (info.attribute[key]) {
          if (info.attribute[key]["ioos_category"] && info.attribute[key]["ioos_category"].value == "Time") {
            dataset.time_dimension = key;
            param_encoder[key] = time_encoder;
          }
        }

      }

    }
    dataset.param_encoder = param_encoder;
    dataset.base_url = this.erddap.base_url;
    dataset.id = this.dataset_id;
    dataset.info = info;
    this._meta = dataset;
    return dataset;
  }.bind(this));
}

Dataset.prototype.fetchMetadata = function() {
  return this._fetchMetadata;
}
Dataset.prototype.generateUrl = function(extension){
  return new DatasetDelegate(this).generateUrl(extension);
}
Dataset.prototype._generateUrl = function(constraints, variables, extension) {
  return this.fetchLocationDimensions().then(function(constraints, variables, extension,locations){
    var extents = {
      lat: {
        min: locations.lats[0],
        max: locations.lats[locations.lats.length-1]
      },
      lon: {
        min: locations.lons[0],
        max: locations.lons[locations.lons.length-1]
      }
    };
    extents[ this._meta.lat_dimension ] = extents.lat;
    extents[ this._meta.lon_dimension ] = extents.lon;
    // only done for griddap so far..
    var url = griddap_url(this._meta,constraints,variables?variables:this._meta._fieldnames.slice(0), extents ,extension);
    if(url.indexOf(TIME_CLOSEST_PLACEHOLDER)>=0){
      return this._resolve_griddap_time_closest(this._meta,url);
    }
    return url;
  }.bind(this,constraints,variables,extension));
}
Dataset.prototype.fetchLocationDimensions = function(useCached){
  useCached = useCached === undefined? true : useCached;
  if(useCached && this._locationDimensions){
    return this._locationDimensions;
  }
  return this.fetchMetadata().then(function(dataset){
    return this._fetchLocationDimensions(dataset,useCached);
  }.bind(this));
}
Dataset.prototype._fetchLocationDimensions = function(dataset,useCached){
  if(useCached && this._locationDimensions){
    return this._locationDimensions;
  }
  var url = dataset.base_url+"/griddap/"+dataset.id+".nc?"+dataset.lat_dimension+","+dataset.lon_dimension;
  this._locationDimensions = fetch(url).then(function(response) {
    if(response.ok){
      return response.arrayBuffer();
    }else{
      throw new Error("Error fetching "+url);
    }
  }).then(function(buffer) {
    var reader = new NetCDFReader(buffer);
    return {
      lats: reader.getDataVariable(reader.variables[0].name),
      lons: reader.getDataVariable(reader.variables[1].name)
    }
  });
  return this._locationDimensions;
}
Dataset.prototype.fetchTimeDimension = function(useCached){
  useCached = useCached === undefined? true : useCached;
  if(useCached && this._timeDimension){
    return this._timedimension;
  }
  return this.fetchMetadata().then(function(dataset){
    return this._fetchTimeDimension(dataset,useCached);
  }.bind(this));
}
Dataset.prototype._fetchTimeDimension = function(dataset,useCached){
  if(useCached && this._timeDimension){
    return this._timeDimension;
  }
  var time_url = dataset.base_url+"/griddap/"+dataset.id+".csv0?"+dataset.time_dimension;
  return fetch(time_url).then(function(response) {
    if(response.ok){
      return response.text();
    }else{
      throw new Error("Error fetching "+time_url);
    }
  }).then(function(text) {
    var times = text.split("\n");
    this._timeDimension = times.filter(function(t){return t && t.length > 0});
    return this._timeDimension;
  });
}
Dataset.prototype._resolve_griddap_time_closest = function(dataset,url){
  return this._fetchTimeDimension(dataset).then(function(times) {
    var now = new Date().toISOString2();
    var closest = 0;
    times.forEach(function(time){
      if(time<now){
        closest = time;
      }
    });
    if(closest){
      closest = "("+closest+")";
    }else{
      closest = "0";
    }
    var re = new RegExp(TIME_CLOSEST_PLACEHOLDER,"g");
    return url.replace(re,closest);
  });
}

Dataset.prototype.constrain = function(constraints) {
  return new DatasetDelegate(this).constrain(constraints);
}
Dataset.prototype.variables = function(variables) {
  return new DatasetDelegate(this).variables(variables);
}

var DatasetDelegate = function(dataset) {
  this.erddap = dataset.erddap;
  this.dataset_id = dataset.dataset_id;
  this._designate = dataset._designate ? dataset._designate : dataset;
  this._constraints = dataset._constraints ? JSON.parse(JSON.stringify(dataset._constraints)) : {};
  this._variables = dataset._variables;
}

DatasetDelegate.prototype.fetchMetadata = function() {
  return this._designate.fetchMetadata();
}
DatasetDelegate.prototype.fetchTimeDimension = function(useCached){
  return this._designate.fetchTimeDimension(useCached);
}
DatasetDelegate.prototype.fetchLocationDimensions = function(useCached){
  return this._designate.fetchLocationDimensions(useCached);
}
DatasetDelegate.prototype._constrain = function(constraints) {
  this._constraints = merge(this._constraints, constraints);
  return this;
}
DatasetDelegate.prototype.constrain = function(constraints) {
  return new DatasetDelegate(this)._constrain(constraints);
}
DatasetDelegate.prototype.variables = function() {
  var variables = Array.prototype.slice.call(arguments);
  if(variables.length == 1 && variables[0].constructor === Array){
    variables = variables[0]
  }
  this._variables = variables;
  return this;
}


DatasetDelegate.prototype.generateUrl = function(extension){
  extension = extension || '.htmlTable';
  return this._designate._generateUrl(this._constraints,this._variables,extension);
}

DatasetDelegate.prototype.vectors = function(ux, uy) {
  return new Vectors(this.variables(ux,uy), ux, uy);
}

var Vectors = function(grid, ux, uy, default_time) {
  this.grid = grid;
  this.ux = ux;
  this.uy = uy;
  this.default_time = default_time;
}

Dataset.prototype.vectors = function(ux, uy) {
  return new DatasetDelegate(this).vectors(ux, uy);
}

Vectors.prototype.generateUrl = function(){
  this.grid._constraints.time = this.grid._constraints.time || "closest";
  return this.grid.generateUrl("nc");
}
/*
 * Returns a promise of fetching the data in the
 * form of an object { time:[time]. lat:[lat],lon:[lon], xvel:[u],yvel:[v] }
 * params are all optional
 * time: {min:, max:, stride:1}, lat: {min:, max:,stride:1}, lon: {min:, max:,stride:1}
 */
Vectors.prototype.fetch = function(params) {
  return this.generateUrl().then(function(url) {
    var ux = this.ux;
    var uy = this.uy;
    var nullx = this.grid._designate._meta.info.attribute[ux].missing_value.value
    var nully = this.grid._designate._meta.info.attribute[uy].missing_value.value
    return fetch(url).then(function(response) {
      if(response.ok){
        return response.arrayBuffer();
      }else{
        throw new Error("Error fetching "+url);
      }
    }).then(function(buffer) {
      var reader = new NetCDFReader(buffer);
      var vars = Array();
      for (var i = 0; i < reader.variables.length; i++) {
        vars.push(reader.getDataVariable(reader.variables[i].name));
      }
      for (var i = 0; i < vars[3].length; i++) {
        if (vars[3][i] == nullx) {
          vars[3][i] = null;
        }
      }
      for (var i = 0; i < vars[4].length; i++) {
        if (vars[4][i] == nully) {
          vars[4][i] = null;
        }
      }
      return {
        time: vars[0],
        lat: vars[1],
        lon: vars[2],
        xvel: vars[3],
        yvel: vars[4]
      };
    });
  }.bind(this));
}

Vectors.prototype.fetchGrib2 = function(params) {
  return this.fetch(params).then(function(data) {
    var atime = data.time,
      alat = data.lat,
      alon = data.lon,
      xvel = data.xvel,
      yvel = data.yvel;
    var results = Array();
    var stride = alat.length * alon.length;
    for (var itime = 0; itime < atime.length; itime++) {
      var time = atime[itime];
      var date = new Date();
      date.setTime(time * 1000);
      var u = {
        header: {
          "parameterCategory": 2,
          "parameterNumber": 2,
          "forecastTime": 0,
          "refTime": date.toISOString2(),
          "nx": alon.length,
          "ny": alat.length,
          "la2": alat[0],
          "lo1": alon[0],
          "la1": alat[alat.length - 1],
          "lo2": alon[alon.length - 1],
        },
        "data": Array(),
      };
      var v = {
        "header": {
          "parameterCategory": 2,
          "parameterNumber": 3,
          "forecastTime": 0,
          "refTime": date.toISOString2(),
          "nx": alon.length,
          "ny": alat.length,
          "la2": alat[0],
          "lo1": alon[0],
          "la1": alat[alat.length - 1],
          "lo2": alon[alon.length - 1],
        },
        "data": Array()
      };
      for (var ilat = 0; ilat < alat.length; ilat++) {
        var slice = itime * (alat.length * alon.length) + ilat * alon.length;
        v.data.unshift(yvel.slice(slice, slice + alon.length));
        u.data.unshift(xvel.slice(slice, slice + alon.length));
      }
      v.data = flatten(v.data);
      u.data = flatten(u.data);
      results.push(u);
      results.push(v);
    }
    for (var i = 0; i < results.length; i++) {
      var header = results[i].header;
      header.dx = Math.abs((header.lo1 - header.lo2) / (header.nx - 1));
      header.dy = Math.abs((header.la1 - header.la2) / (header.ny - 1));
    }
    return results;
  });
}

Erddap.prototype.dataset = function(dataset_id) {
  this._datasets[dataset_id] = this._datasets[dataset_id] || new Dataset(this, dataset_id);
  return this._datasets[dataset_id];
}

function flatten(a) {
  return [].concat.apply([], a);
}

module.exports = Erddap;
