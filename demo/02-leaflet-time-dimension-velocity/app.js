
var map;
var erddap = new ERDDAP('https://erddap.marine.ie/erddap');
var ds = erddap.dataset('IMI_NEATL');
ds.fetchTimeDimension().then(function(times){
  times = times.map(function(d){return new Date(d)});
  map = L.map('map', {
   zoom: 10,
   //crs: L.CRS.EPSG4326,
   center: [51.637, -10.124],
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
 initDemoMap(map);
  var velocityLayer = L.timeDimension.layer.velocity({
    maxBuffer: 24*4,
    fetchGrib2: function(time,bounds){
      return ds.constrain({time: time, bbox: bounds.toBBoxString()}).vectors(
        'sea_surface_x_velocity','sea_surface_y_velocity')
            .fetchGrib2();
    }
  });
  velocityLayer.addTo(map);
});
