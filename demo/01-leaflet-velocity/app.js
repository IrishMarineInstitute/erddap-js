
// demo map see demomap.js
var mapStuff = initDemoMap();
var map = mapStuff.map;
var layerControl = mapStuff.layerControl;

// Draw a velocity layer using data from ERDDAP.
var erddap = new ERDDAP('https://erddap.marine.ie/erddap');
var ds = erddap.dataset('IMI_CONN_2D').constrain({time: "closest"});

ds.vectors('barotropic_sea_water_x_velocity','barotropic_sea_water_y_velocity')
      .fetchGrib2().then(function(data){
        var velocityLayer = L.velocityLayer({
      		displayValues: true,
      		displayOptions: {
      			velocityType: 'GBR Water',
      			displayPosition: 'bottomleft',
      			displayEmptyString: 'No water data'
      		},
      		data: data,
      		maxVelocity: 0.6,
      		velocityScale: 0.1 // arbitrary default 0.005
      	});

      	layerControl.addOverlay(velocityLayer, 'Ocean Current - Galway Bay');
        velocityLayer.addTo(map);
});
