var erddap = new ERDDAP('https://erddap.marine.ie/erddap');
var ds = erddap.dataset('IMI_CONN_2D').constrain({time: "last"});
if(false){
  ds.vectors('barotropic_sea_water_x_velocity','barotropic_sea_water_y_velocity')
        .fetchGrib2().then(function(x){
                  console.log("hey",x);
                });
}
