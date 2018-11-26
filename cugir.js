var cugirjson;
var map;

$(document).ready(function(){
  cugirjson = cleanData(cugirjson);
  map = setupMap();
  $(document).on('click', 'img#logo', resetPage);
  $(document).on('click', '#results li', clickResultItem);
  $(document).on('click', 'button.prev', clickPrevButton);
  $(document).on('click', 'button.next', clickNextButton);
  $(document).on('click', '#backToSearch', backToSearch);
  $(document).on('click', '#newSearch', showHome);
  $(document).on('submit', 'form#search', submitQuery);
  $(document).on('mouseover', '#results li', mouseoverResultItem);
  $(document).on('mouseout', '#results li', mouseoutResultItem);
  interpretHash();
});

function interpretHash(){
  var hash = location.hash;
  if (!hash) {
    showHome();
    return;
  }
  // search for whatever is after the #
  search(hash.slice(1));
}

function setupMap(){
  map = L.map('map', {
    fadeAnimation:false,
    // TODO set to max bounds of all data
    center: [43,-76],
    zoom: 6
  });
  var osm = L.tileLayer.colorFilter('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
    isBasemap: true,
    maxZoom: 19,
    opacity: 1,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://carto.com/location-data-services/basemaps/">Carto</a>',
    filter: [
      'brightness:75%',
      'contrast:200%',
      'saturate:200%'
    ]
  }).addTo(map);
  map.on('click', mapClick);
  return map;
}

function cleanData(cugirjson){
  var data = [];
  for (var i=0; i<cugirjson.length; i++) {
    var item = cugirjson[i];
    item.dct_references_s = JSON.parse(item.dct_references_s);
    var item2 = {
      id: item.layer_slug_s,
      title: item.dc_title_s,
      author: item.dc_creator_sm,
      publisher: item.dc_publisher_sm,
      description: item.dc_description_s,
      collection: item.dct_isPartOf_sm,
      category: item.cugir_category_sm,
      subject: item.dc_subject_sm,
      place: item.dct_spatial_sm,
      year: item.dct_temporal_sm,
      format: item.dc_format_s,
      geom_type: item.layer_geom_type_s,
      filesize: item.cugir_filesize_s,
      metadata: item.dct_references_s['http://www.w3.org/1999/xhtml'],
      layerid: item.layer_id_s,
      wms: item.dct_references_s['http://www.opengis.net/def/serviceType/ogc/wms'],
      wfs: item.dct_references_s['http://www.opengis.net/def/serviceType/ogc/wfs'],
      download: item.dct_references_s['http://schema.org/downloadUrl'],
      addl_downloads: JSON.parse(item.cugir_addl_downloads_s),
      bbox: bbox(item.solr_geom)
    };
    data.push(item2);
  }
  return data;
}

function resetPage() {
  $('#q').val('');
  showHome();
}

function bbox(solr_geom) {
  // return leaflet bbox for solr_geom values like "ENVELOPE(minx, maxx, maxy, miny)"
  [minx, maxx, maxy, miny] = solr_geom.match(/(-?\d+\.?\d*)/g);
  return [
    [ parseFloat(miny), parseFloat(minx) ],
    [ parseFloat(maxy), parseFloat(maxx) ]
  ];
}

function showHome() {
  location.hash = '';
  clearMap();
  // TODO set to max bounds of all data
  map.setView([43,-76], 6);
  var catstat = stats('category');
  var categories = Object.keys(catstat);
  categories = categories.sort(function(a,b){
    if (a<b) return -1
    else if (a>b) return 1;
    else return 0;
  });
  $('#body').html('\
    <div class="home">\
      <h1>Welcome to CUGIR!</h1>\
      <p>Explore and discover New York State data and metadata related to:</p>\
      <div id="categories"></div>\
    </div>\
  ');
  for (var i=0; i<categories.length; i++) {
    $('<a>')
      .text(categories[i])
      .click(clickCategory)
      .appendTo('#categories');
    $('<span class="count">').html('&nbsp;(' + catstat[categories[i]] + ') ')
      .appendTo('#categories');
  }
}

function clickCategory(e){
  var category = $(e.target).text();
  search('category="'+category+'"');
}

function submitQuery(e){
  var q = $('#q').val();
  search(q);
  e.preventDefault();
}

function clearMap(){
  var layers = map.eachLayer(function(layer){
    if (! layer.options.isBasemap) {
      layer.remove();
    }
  });
  $('table.featureInfo').remove();
}

function escapeForHash(q){
  var hash = escape(q.replace(/\//g, '//'))
    .replace(/%20/g, '+')
    .replace(/%3A/g, ':')
    .replace(/%3D/g, '=');
  return hash;
}

function search(q){
  if (q.length == 0) {
    showHome();
    return;
  }
  // remove superfluous quotes around single words
  q = q.replace(/"(\w+)"/g, '$1');
  location.hash = escapeForHash(q);
  $('#q').val(q);
  var results = filter(cugirjson, q);
  $('#body').html('');
  clearMap();
  var bounds;
  $('<div id="nav">').text(Object.keys(results).length + ' matches for ').append(
    $('<span>').addClass('q').text(q)
  ).appendTo('#body');
  var ul = $('<ul id="results">').data('q', q);
  for (var i in results) {
    var item = results[i];
    if (! bounds) {
      bounds = L.latLngBounds(item.bbox);
    }
    bounds.extend(item.bbox);
    renderResult(item).appendTo(ul);
  }
  ul.appendTo('#body');
  $('html').scrollTop(0);
  if ($('#results li').length == 1) {
    // expand details if only one item
    $('#results li').click();
    return;
  }
  if (bounds) {
    map.flyToBounds(bounds, { duration:1 });
  }
}

var bbox_default_style = {
  color: '#222',
  opacity: 1,
  weight: 1,
  fillColor: '#fff',
  fillOpacity: 0,
  isBbox: true
};

var bbox_active_style = {
  color:'#00f',
  opacity:0.7,
  weight:4,
  fillColor:'#88f',
  fillOpacity:0.5
}

var bbox_selected_style = {
  color:'#e68742',
  opacity:0.7,
  weight:4,
  fillOpacity:0
}

function renderResult(item){
  var li = $('<li>').data('item', item);
  $('<div class="title">').text(item.title).appendTo(li);
  $('<div class="brief">').text(item.description).appendTo(li);
  itemDetails(item).appendTo(li);
  $('<span>').text(item.creator+'. ').prependTo(li.find('.description'));
  var bboxlayer = renderItemBbox(item);
  li.data('bbox', bboxlayer);
  return li;
}

function renderItemBbox(item){
  // add bbox to map
  var layer = L.rectangle(item.bbox, bbox_default_style).addTo(map);
  return layer;
}

function mouseoverResultItem(e){
  var item = $(e.currentTarget);
  if ($('#results li.selected').length > 0) {
    // ignore mouseover if any item is selected (in detail view)
    return;
  }
  var bbox = item.data('bbox');
  if (bbox) {
    bbox.setStyle(bbox_active_style).bringToFront();
  }
}

function mouseoutResultItem(e){
  var item = $(e.currentTarget);
  var bbox = item.data('bbox');
  bbox.setStyle(bbox_default_style);
}

function backToSearch(){
  var q = $('#results').data('q');
  var scroll = $('#results').data('scroll')-120;
  $('#q').val(q);
  search(q);
  $('html').scrollTop(scroll);
}

function clickResultItem(e){
  // clear the selection
  $('#results li.selected').removeClass('selected');

  // select the clicked item and show it
  var li = $(e.currentTarget).addClass('selected').show();

  // remember current scroll position
  $('#results').data('scroll', li.offset().top);

  // go to top of page
  $('html').scrollTop(0);
  var item = li.data('item');

  // add cugir id to the URL hash
  location.hash = 'id='+item.id;

  clearMap();
  $('#results li:not(.selected)').hide();

  var nav = $('#nav').html('');
  $('<button class="prev">')
    .text('« previous')
    .appendTo(nav);
  nav.append( $('#results li').index(li) + 1);
  nav.append(' of ');
  nav.append( $('#results li').length );
  $('<button class="next">')
    .text('next »')
    .appendTo(nav);
  $('<a id="newSearch">')
    .text('New Search')
    .attr('href', '#')
    .appendTo(nav);
  $('<a id="backToSearch">')
    .text('Back to Search')
    .attr('href', '#'+ escapeForHash($('#results').data('q')))
    .appendTo(nav);

  map.flyToBounds(item.bbox, { duration:1 });
  var bboxlayer = renderItemBbox(item);
  bboxlayer.setStyle(bbox_selected_style);
  if (item.wms) {
    var layer = L.tileLayer.wms(item.wms, {
      layers: item.layerid,
      format: 'image/png',
      transparent: true,
      tiled:true
    });
    li.data('layer', layer);
    layer.addTo(map).bringToFront();
  }
}

function clickPrevButton(){
  var prev = $('#results li.selected').prev();
  if (prev) {
    prev.click();
  }
}

function clickNextButton(){
  var next = $('#results li.selected').next();
  if (next) {
    next.click();
  }
}

function mapClick(e){
  var selected = $('#results li.selected');
  // make sure we have a wms layer
  if (selected.length<1) return;
  var item = selected.data('item');
  var lat = e.latlng.lat;
  var lng = e.latlng.lng;
  // https://cugir.library.cornell.edu/geoserver/cugirwfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=cugir008186&srsName=EPSG:4326&bbox=42.1634,-76.5687,42.1634,-76.5687&outputFormat=json
  params = {
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: 'cugir:' + item.layerid,
    srs: 'EPSG:4326',
    bbox: [lat,lng,lat,lng].join(','),
    outputFormat: 'json'
  };
  var url = 'https://alteriseculo.com/proxy/?url=' + encodeURIComponent(item.wfs + L.Util.getParamString(params));
  $.ajax({
    url: url,
    dataType: 'json',
    success: function(data,status,xhr){
      console.log(status);
      var properties = data.features[0].properties;
      console.log(properties);

      // is this for an index map?
      var subset = $('#results li.selected .subset');
      if (subset.length>0) {
        // add text before the first selected subset
        if (subset.children().length==0) {
          subset.append('Selected data subsets: ');
        }
        // add subset download button
        subset
          .append(subsetDownload(properties))
          .append(' ');
      }
      else {
        // if not an index map, remove any other selected features
        map.eachLayer(function(layer){
          console.log(layer);
          if (layer.options.isSelection) {
            layer.remove();
          }
        });
      }

      // show feature and info
      var layer = L.geoJSON(data, {
        //display as little circles
        pointToLayer: function(point, latlng) {
          return L.circleMarker(latlng);
        },
        style: bbox_active_style,
        isSelection: true
      }).addTo(map);
      popupInfo(properties);
    },
    error: function(xhr, status, error){
      console.log(xhr);
      console.log(status);
      console.log(error);
    }
  });
}

function popupInfo(properties){
  $('table.featureInfo').remove();
  var table = $('<table class="featureInfo">').appendTo('#map');
  for (var p in properties) {
    var v = properties[p];
    var tr = $('<tr>').appendTo(table);
    $('<th>').text(p).appendTo(tr);
    $('<td>').text(v).appendTo(tr);
  }
}

function subsetDownload(p){
  // TODO simplify this by switching to standard openindexmaps properties
  var label = p.name || p.usgs_name || p.title || p.countyname;
  var a =  $('<a>')
    .addClass('download')
    .attr('target', '_blank')
    .attr('href', p.download)
    .text( label );
  return a;
}

function itemDetails(item){
  var details = $('<div class="details">');
  var table = $('<table>').appendTo(details);
  var properties = [
    'author',
    //'publisher' is generally redundant with author
    'description',
    'collection',
    'category',
    'subject',
    'place',
    'year',
    'filesize'
  ];
  for (var i=0; i<properties.length; i++) {
    var p = properties[i];
    var v = item[p];
    if (!v) continue;
    var tr = $('<tr>').appendTo(table);
    $('<th>').text(p).appendTo(tr);
    $('<td>').html(linkify(p, v)).appendTo(tr);
  }

  // METADATA
  var tr = $('<tr>').appendTo(table);
  $('<th>').text('more details').appendTo(tr);
  var td = $('<td>').appendTo(tr);
  $('<a>').attr('href', item.metadata).attr('target', '_blank').text('metadata').appendTo(td);

  // DOWNLOAD
  var tr = $('<tr>').prependTo(table);
  $('<th>').text('download').appendTo(tr);
  var td = $('<td>').appendTo(tr);
  td.append(downloadSection(item));

  // ALERT IF NO WMS IMAGE IS AVAILABLE
  if (! item.wms) {
    var tr = $('<tr class="alert">').prependTo(table);
    $('<th>').text('note').appendTo(tr);
    $('<td>').text('Map previews are not available for the '+item.format+' file format.')
      .appendTo(tr);
  }

  return details;
}

function downloadSection(item){
  var div = $('<div>');
  var isIndexMap = item.category.indexOf('index map')>-1;
  if (isIndexMap) {
    $('<p class="alert">')
      .text('This is an index map.  Please select features on the map to display the corresponding download links.')
      .appendTo(div);
    $('<div class="subset">').appendTo(div);
  }
  // main download file
  $('<a>')
    .addClass('download')
    .attr('target', '_blank')
    .attr('href', item.download)
    .text(item.format + (isIndexMap ? ' (index map only)' : '') )
    .appendTo(div);

  // addl_downloads
  if (item.addl_downloads) {
    for (var k in item.addl_downloads) {
      $('<a>')
        .addClass('download')
        .attr('target', '_blank')
        .attr('href', item.addl_downloads[k])
        .text(k)
        .appendTo(div);
    }
  }
  return div;
}

function linkify(p, v){
  if (p==='collection' || p==='category' || p==='place') {
    // make sure v is an array
    if (! Array.isArray(v)) {
      v = [v];
    }
    var div = $('<div>');
    var count = 0;
    for (var i=0; i<v.length; i++) {
      var vi = v[i];
      if (count++) {
        div.append(', ');
      }
      $('<a>')
        .attr('href', "javascript:search('"+p+'="'+vi+'"'+"')")
        .text(vi)
        .appendTo(div);
    }
    return div;
  }
  else if (Array.isArray(v)) {
    return v.join(', ');
  }
  return v;
}


function stats(property){
  var seen = {}
  for (var i=0; i<cugirjson.length; i++) {
    var item = cugirjson[i];
    var value = item[property];
    for (var j=0; j<value.length; j++) {
      var valuej = value[j];
      if (typeof seen[valuej] !== 'undefined') {
        seen[valuej] += 1;
      }
      else {
        seen[valuej] = 1;
      }
    }
  }
  return seen;
}
