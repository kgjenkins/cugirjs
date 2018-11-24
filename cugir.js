var cugirjson;
var map;

$(document).ready(function(){
  cugirjson = cleanData(cugirjson);
  map = setupMap();
  showHome();
  $(document).on('click', 'img#logo', resetPage);
  $(document).on('submit', 'form#search', submitQuery);
  $(document).on('click', '#results li', clickResultItem);
  $(document).on('mouseover', '#results li', mouseoverResultItem);
  $(document).on('mouseout', '#results li', mouseoutResultItem);
});

function setupMap(){
  map = L.map('map', {
      fadeAnimation:false,
      center: [43,-76],
      zoom: 6
    })
    .on('click', function(e) {
      console.log(e.latlng);
    });
  var osm = L.tileLayer.colorFilter('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
    isBasemap: true,
    maxZoom: 19,
    opacity: 0.3,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="https://carto.com/location-data-services/basemaps/">Carto</a>',
    filter: [
      'brightness:60%',
      'contrast:400%',
      'saturate:150%'
    ]
  }).addTo(map);
  return map;
}

function cleanData(cugirjson){
  var data = [];
  for (var i=0; i<cugirjson.length; i++) {
    var item = cugirjson[i];
    item.dct_references_s = JSON.parse(item.dct_references_s);
    var item2 = {
      title: item.dc_title_s,
      creator: item.dc_creator_sm,
      description: item.dc_description_s,
      place: item.dct_spatial_sm,
      category: item.cugir_category_sm,
      subject: item.dc_subject_sm,
      year: item.dct_temporal_sm,
      filesize: item.cugir_filesize_s,
      metadata: item.dct_references_s['http://www.w3.org/1999/xhtml'],
      layerid: item.layer_id_s,
      wms: item.dct_references_s['http://www.opengis.net/def/serviceType/ogc/wms'],
      wfs: item.dct_references_s['http://www.opengis.net/def/serviceType/ogc/wfs'],
      download: item.dct_references_s['http://schema.org/downloadUrl'],
      addl_downloads: item.cugir_addl_downloads_s,
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
  clearMap();
  var catstat = stats('category');
  var categories = Object.keys(catstat);
  categories = categories.sort(function(a,b){
    if (a<b) return -1
    else if (a>b) return 1;
    else return 0;
  });
  $('#body').html('<h1>Welcome to CUGIR!</h1><p>Explore and discover New York State data and metadata related to:</p><div id="categories"></div>');
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
}

function search(q){
  $('#q').val(q);
  var results = filter(cugirjson, q);
  $('#body').html('');
  clearMap();
  var bounds;
  $('<div id="searchSummary">').text(Object.keys(results).length + ' matches for ').append(
    $('<span>').addClass('q').text(q)
  ).appendTo('#body');
  var ul = $('<ul id="results">');
  for (var i in results) {
    var item = results[i];
    if (! bounds) {
      bounds = L.latLngBounds(item.bbox);
    }
    bounds.extend(item.bbox);
    renderResult(item).appendTo(ul);
  }
  ul.appendTo('#body');
  map.flyToBounds(bounds);
}

var bbox_default_style = {
  color: '#222',
  opacity: 0.5,
  weight: 1,
  fillColor: '#080',
  fillOpacity: 0.05,
  isBbox: true
};

var bbox_active_style = {
  color:'#00f',
  opacity:0.7,
  weight:4,
  fillColor:'#88f',
  fillOpacity:0.5
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
  var bbox = item.data('bbox');
  if (bbox) {
    bbox.bringToFront().setStyle(bbox_active_style);
  }
}

function mouseoutResultItem(e){
  var item = $(e.currentTarget);
  var bbox = item.data('bbox');
  bbox.setStyle(bbox_default_style);
}

function clickResultItem(e){
  $('#results li.selected').removeClass('selected');
  var li = $(e.currentTarget).toggleClass('selected');
  //li.find('.details').slideToggle(1000);
  var item = li.data('item');
  clearMap();
  if (item.wms) {
    var layer = L.tileLayer.wms(item.wms, {
      layers: item.layerid,
      format: 'image/png',
      transparent: true,
      attribution: "CUGIR"
    });
    li.data('layer', layer);
    layer.addTo(map).bringToFront();
  }
  else {
    var bboxlayer = renderItemBbox(item);
    bboxlayer.setStyle(bbox_active_style);
  }
  map.flyToBounds(item.bbox, { duration:2 });
}

function itemDetails(item){
  var details = $('<div class="details">');
  var table = $('<table>').appendTo(details);
  var properties = [
    'author',
    'description',
    'collection',
    'place',
    'category',
    'subject',
    'year',
    'filesize',
    'metadata'
  ];
  for (var i=0; i<properties.length; i++) {
    var p = properties[i];
    var v = item[p];
    if (!v) continue;
    var tr = $('<tr>').appendTo(table);
    $('<th>').text(p).appendTo(tr);
    $('<td>').text(v).appendTo(tr);
  }
  return details;
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
