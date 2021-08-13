
  // generated downloads
  if (item.wfs) {
    // generate geojson if there isn't already such a download
    if (item.format !== 'GeoJSON' &&
        !item.addl_downloads.GeoJSON) {
      var params = {
        service: 'WFS',
        version: '2.0.0',
        request: 'GetFeature',
        typeNames: 'cugir:' + item.layerid,
        maxFeatures: 999999,
        srs: 'EPSG:4326',
        outputFormat: 'json'
      }
      $('<a>')
        .text('GeoJSON (generated' + indextext + ')')
        .addClass('download')
        .attr('target', '_blank')
        .attr('href', item.wfs + L.Util.getParamString(params))
        .appendTo(div)
      div.append(' ')
    }

    // generate kml if there isn't already such a download
    if (item.format !== 'KML' &&
        !item.addl_downloads.KML) {
      params = {
        service: 'WMS',
        version: '1.1.0',
        request: 'GetMap',
        layers: 'cugir:' + item.layerid,
        maxFeatures: 999999,
        srs: 'EPSG:4326',
        // we have to flip yx -> xy
        bbox: item.bbox[0][1] + ',' + item.bbox[0][0] + ',' + item.bbox[1][1] + ',' + item.bbox[1][0],
        height: 1, // height/width are required, but don't matter
        width: 1,
        format: 'application/vnd.google-earth.kmz+xml'
      }
      $('<a>')
        .text('KML (generated' + indextext + ')')
        .addClass('download')
        .attr('target', '_blank')
        .attr('href', item.wms + L.Util.getParamString(params))
        .appendTo(div)
      div.append(' ')
    }
  }
