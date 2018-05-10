function initDemoMap(map){

    var Esri_WorldImagery = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esr et al.'
    });

    var Esri_DarkGreyCanvas = L.tileLayer(
        "http://{s}.sm.mapstack.stamen.com/" +
        "(toner-lite,$fff[difference],$fff[@23],$fff[hsl-saturation@20])/" +
        "{z}/{x}/{y}.png",
        {
            attribution: 'Esri et al.'
        }
    );

    var baseLayers = {
        "Satellite": Esri_WorldImagery,
        "Grey Canvas": Esri_DarkGreyCanvas
    };
    Esri_WorldImagery.addTo(map);

    var layerControl = L.control.layers(baseLayers);
    layerControl.addTo(map);
    //map.setView([53.35, -9.714], 10);

    return {
        map: map,
        layerControl: layerControl
    };
}
