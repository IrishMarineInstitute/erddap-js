
var map;


var erddap = new ERDDAP('https://erddap.marine.ie/erddap');
var dataset_id = 'IMI_CONN_3D', variable = 'Sea_water_temperature';


var ds = erddap.dataset(dataset_id);
ds.fetchTimeDimension().then(function(times){
  ds.fetchMetadata().then(function(meta){
    var attr = meta.info.attribute['Sea_water_temperature'];
    var colorscalerange = attr.colorBarMinimum.value + "," +
               attr.colorBarMaximum.value;
    var nc_global = meta.info.attribute['NC_GLOBAL'];


    times = times.map(function(d){return new Date(d)});
    map = L.map('map', {
     zoom: 9,
     //crs: L.CRS.EPSG4326,
     center: [53.3, -10],
     fullscreenControl: true,
     timeDimensionControl: true,
     timeDimension: true,
     timeDimensionOptions: {
         times: times
     },
     timeDimensionControlOptions: {
        maxSpeed: 2,
         playerOptions: {
             loop: true,
             transitionTime: 1000,
             minBufferReady: 3
         }
     }
   });
   var bounds = [[parseFloat(nc_global.geospatial_lat_min.value),parseFloat(nc_global.geospatial_lon_min.value)],
                   [parseFloat(nc_global.geospatial_lat_max.value),parseFloat(nc_global.geospatial_lon_max.value)]];
   var mapLatLngBounds = L.latLngBounds(bounds);
   map.fitBounds(mapLatLngBounds);
   initDemoMap(map);

   var legend = L.control({position: 'bottomright'});

   legend.onAdd = function (map) {
         var el = document.getElementById("erddapLegend");
         if(el){
            el.parentNode.removeChild(el);
         }
     var div = L.DomUtil.create('div', 'info');
            div.innerHTML += '<img width="275px" id="erddapLegend" alt="legend" src="">';
     return div;
   };
   legend.addTo(map);

   var wmsLayer = L.tileLayer.wms(erddap.base_url+"/wms/"+dataset_id+"/request", {
              layers: dataset_id + ':' + variable,
              format: 'image/png',
              transparent: true,
              abovemaxcolor: "extend",
              belowmincolor: "extend",
              numcolorbands: 40,
              colorscalerange: colorscalerange,
              crs: L.CRS.EPSG4326,
              opacity: 0.8
            });
    var timeDimensionLayer = L.timeDimension.layer.wms(wmsLayer,{cache: 15, fadeFrames: 10, interpolate: true});
    timeDimensionLayer.addTo(map);

    timeDimensionLayer.on("timeload", function(){
            var t = wmsLayer.options.time;
            var img = new Image();
            img.onload = (function(image){
               var el = document.getElementById("erddapLegend");
               if(el){
                el.src = image.src;
               }
            }).bind(null,img);
            var constraints = {};
            constraints[meta.time_dimension] = new Date(t);
            var skip = [meta.time_dimension,meta.lat_dimension,meta.lon_dimension];
            //TODO: allow user to select the values of these other dimensions.
            Object.keys(meta.info.dimension).forEach(function(k){
              if(skip.indexOf(k)<0){
                constraints[k] = "last";
              }
            });
            ds.constrain(constraints).variables(variable).generateUrl(".transparentPng").then(function(url){
              img.src = url+"&.legend=Only";
            });
          });
  });
});
