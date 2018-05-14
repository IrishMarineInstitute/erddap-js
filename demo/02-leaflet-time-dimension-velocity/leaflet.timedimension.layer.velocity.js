L.TimeDimension.Layer.Velocity = L.TimeDimension.Layer.extend({

    initialize: function(options) {
        if(!(options && options.fetchGrib2 && {}.toString.call(options.fetchGrib2 ) === '[object Function]')){
          throw("Missing required option fetchGrib2: (returns a Promise) options.fetchGrib2(time,bounds)");
        }
        this._velocityLayerCfg = this._getVelocityOptions(options.velocityLayerOptions || {});
        var layer = new L.velocityLayer(this._velocityLayerCfg);
        L.TimeDimension.Layer.prototype.initialize.call(this, layer, this._options);
        this._options = options;
        this._fetchGrib2 = this._options.fetchGrib2;
        this._maxBuffer = this.options.maxBuffer || 100;
        this._data = [];
        this._promises = {};
    },
    _getEmptyData: function(){
      return [{
        header: {
          "parameterCategory": 2,
          "parameterNumber": 2,
          "forecastTime": 0,
          "refTime": "1970-01-01T00:00:00Z",
          "nx": 0,
          "ny": 0,
          "la2": 0,
          "lo1": 0,
          "la1": 0,
          "lo2": 0,
        },
        "data": [],
      },{
        "header": {
          "parameterCategory": 2,
          "parameterNumber": 3,
          "forecastTime": 0,
          "refTime": "1970-01-01T00:00:00Z",
          "nx": 0,
          "ny": 0,
          "la2": 0,
          "lo1": 0,
          "la1": 0,
          "lo2": 0,
        },
        "data": []
      }];
    },
    _getVelocityOptions: function(options) {
        var config = {};
        var defaultConfig = {
      		displayValues: true,
      		displayOptions: {
      			velocityType: 'GBR Water',
      			displayPosition: 'bottomleft',
      			displayEmptyString: 'No water data'
      		},
      		data: this._getEmptyData(),
      		maxVelocity: 0.6,
      		velocityScale: 0.1 // arbitrary default 0.005
      	};
        for (var attrname in defaultConfig) {
            config[attrname] = defaultConfig[attrname];
        }
        for (var attrname in options) {
            config[attrname] = options[attrname];
        }
        return config;
    },

    onAdd: function(map) {
        L.TimeDimension.Layer.prototype.onAdd.call(this, map);
        map.addLayer(this._baseLayer);
        if (this._timeDimension) {
            this._getDataForTime(this._timeDimension.getCurrentTime(),true);
        }
    },

    _update: function() {
        var currentTime = this._timeDimension.getCurrentTime();
        if(this._currentTime != currentTime){
          var data = this._getDataForTime(currentTime);
          if(data){
              this._currentTime = currentTime;
              this._baseLayer.setData(data);
            }
        }
    },

    _onNewTimeLoading: function(ev) {
        this._getDataForTime(ev.time,true);
    },

    isReady: function(time) {
        return this._getDataForTime(time,true) === undefined? false : true;
    },

    getEvents: function() {
        var clearCache = L.bind(this._clearCache, this);
        var update = L.bind(this._update, this);
        return {
            moveend: clearCache,
            zoomend: clearCache,
            timeload: update
        }
    },
    _clearCache: function(){
      this._data = [];
    },
    _getDataForTime: function(time,load) {
      if (!this._map) {
          return undefined;
      }
      var bounds = this._map.getBounds();
      var bbox = bounds.toBBoxString();
      var timestring = ""+time;
      for(var i=this._data.length-1;i>=0;i--){
        if(this._data[i].timestring == timestring){
          //since it's wanted, move item to end of array, kind of an LRU
          var e = this._data[i];
          this._data.splice(i, 1);
          this._data.push(e);
          return e.data;
        }
      }
      var promise_key = timestring + bbox;
      if(load && !this._promises[promise_key]){
        this._promises[promise_key] = this._fetchGrib2(time,bounds).then(function(time,bbox,data){
          if(this._map.getBounds().toBBoxString() == bbox){
            this._data.push({timestring: ""+time, data: data});
            while(this._data.length && this._data.length > this._maxBuffer){
              this._data.shift();
            }
            this.fire('timeload', {
              time: time
            });
            if(time == this._timeDimension.getCurrentTime()){
              this._update();
            }
          }
          delete this._promises[promise_key];
        }.bind(this,time,bbox)).catch(function(key,e){
          delete this._promises[promise_key];
          console.log(e);
        }.bind(this,promise_key));

      }
      return undefined;
    },

});

L.timeDimension.layer.velocity = function(options) {
    return new L.TimeDimension.Layer.Velocity(options);
};
