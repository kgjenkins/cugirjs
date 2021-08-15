/* global $ L leafletPip filter cugirjson:writeable */

let map
let config // this will get set by config.js
const styles = []

$(document).ready(function () {
  cugirjson = cleanData(cugirjson)
  setupMap()
  setupStyles()
  $(document).on('click', 'img#logo', home)
  $(document).on('click', '#results li', clickResultItem)
  $(document).on('click', 'button.prev', clickPrevButton)
  $(document).on('click', 'button.next', clickNextButton)
  $(document).on('click', '#backToSearch', backToSearch)
  $(document).on('click', '#resetButton', home)
  $(document).on('click', 'button.more', showMore)
  $(document).on('click', '#attr button.close', clearSelections)
  $(document).on('click', '#download-all', downloadAll)
  $(document).on('submit', 'form#search', submitQuery)
  $(document).on('mouseover', '#results > li', mouseoverResultItem)
  $(document).on('mouseout', '#results > li', mouseoutResultItem)
  $(document).on('keydown', listenForKeys)
  window.onhashchange = function () {
    // determine if browser back/forward buttons are clicked and if so...
    // interpretHash()
  }
  interpretHash()
})

function interpretHash () {
  const hash = window.location.hash
  if (!hash) {
    home()
    return
  }
  // search for whatever is after the #
  search(unescapeHash(hash.slice(1)))
}

function listenForKeys (e) {
  if (e.key === 'Escape') {
    clearSelections()
  } else if (e.key === 'PageDown') {
    clickNextButton()
  } else if (e.key === 'PageUp') {
    clickPrevButton()
  }
}

function setupMap () {
  map = L.map('map')

  // zoom to NYS
  map.fitBounds([[40.5, -80], [45, -71.8]])

  // add basemap using colorFilter to enhance/balance coloration
  L.tileLayer.colorFilter('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
    isBasemap: true,
    maxZoom: 21,
    opacity: 1,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://carto.com/location-data-services/basemaps/">Carto</a>',
    filter: [
      'brightness:250%',
      'contrast:100%'
    ]
  }).addTo(map)
  map.on('click', clickMap)
}

function cleanData (cugirjson) {
  cugirjson = cugirjson.response.docs
  const data = []
  for (let i = 0; i < cugirjson.length; i++) {
    const item = cugirjson[i]
    item.dct_references_s = JSON.parse(item.dct_references_s)
    const item2 = {
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
      openindexmaps: item.dct_references_s['https://openindexmaps.org'],
      download: item.dct_references_s['http://schema.org/downloadUrl'],
      addl_downloads: JSON.parse(item.cugir_addl_downloads_s),
      bbox: leafletBbox(item.solr_geom)
    }
    data.push(item2)
  }
  return data
}

function leafletBbox (solrGeom) {
  // return leaflet bbox for solr_geom values like "ENVELOPE(minx, maxx, maxy, miny)"
  const m = solrGeom.match(/(-?\d+\.?\d*)/g)
  const minx = m[0]
  const maxx = m[1]
  const maxy = m[2]
  const miny = m[3]
  return [
    [parseFloat(miny), parseFloat(minx)],
    [parseFloat(maxy), parseFloat(maxx)]
  ]
}

function go (hash, title) {
  window.location.hash = hash
  document.title = title
}

function home () {
  go('', 'CUGIRjs')
  $('#q').val('')
  $('#summary').html('')
  clearMap()
  // zoom to NYS
  map.fitBounds([[40.5, -80], [45, -71.8]])
  const catstat = stats('category')
  let categories = Object.keys(catstat)
  categories = categories.sort(function (a, b) {
    if (a < b) return -1
    else if (a > b) return 1
    else return 0
  })
  $('#body').html(
    '<div class="home">' +
      '<h1>Welcome to CUGIR!</h1>' +
      '<p>Explore and discover New York State geospatial data:</p>' +
      '<ul id="categories"></ul>' +
      '<p style="margin:4em ; color:#fff ; background:#f00 ; padding:1em">This is an EXPERIMENTAL javascript interface to <a href="https://cugir.library.cornell.edu/" style="color:#fc0 ; font-weight:bold ; text-decoration:underline">CUGIR</a>.</p>' +
    '</div>'
  )
  // list all categories (and the number of datasets for each)
  for (let i = 0; i < categories.length; i++) {
    const li = $('<li>').appendTo('#categories')
    $('<a>')
      .text(categories[i])
      .attr('href', '#category="' + categories[i] + '"')
      .click(clickLink)
      .appendTo(li)
    $('<span class="count">').html('&nbsp;(' + catstat[categories[i]] + ') ')
      .appendTo(li)
  }
  return false
}

function showMore (e) {
  $(e.target).hide()
  $(e.target).next().show()
}

function clickLink (e) {
  // click a link with a hash href like #category=transportation
  const q = $(e.target).attr('href').substr(1)
  search(q)
  return false
}

function submitQuery (e) {
  const q = $('#q').val()
  const qbounds = map.getBounds()
  search(q, qbounds)
  e.preventDefault()
}

function clearMap () {
  map.eachLayer(function (layer) {
    if (!layer.options.isBasemap) layer.remove()
  })
  $('#attr').remove()
  $('#zoom').remove()
}

function unescapeHash (h) {
  return unescape(h).replace(/\+/g, ' ')
}

function escapeForHash (q) {
  const hash = escape(q.replace(/\//g, '//'))
    .replace(/%20/g, '+')
    .replace(/%3A/g, ':')
    .replace(/%3D/g, '=')
  return hash
}

function search (q, qbounds) {
  // remove superfluous quotes around single words
  q = q.replace(/"(\w+)"/g, '$1')
  go(escapeForHash(q), 'search for ' + q)
  $('#q').val(q)
  let results = filter(cugirjson, q)
  results = rankResults(results, qbounds)
  $('#body').html('')
  clearMap()
  let bounds
  $('#summary').html('')
  const nav = $('<div id="nav">').text(Object.keys(results).length + ' matches')
  if (q) {
    nav.append(' for ')
    $('<a>')
      .addClass('q')
      .text(q)
      .attr('href', '#' + q)
      .click(backToSearch)
      .appendTo(nav)
  }
  nav.prependTo('#summary')
  const ul =
    $('<ul id="results">')
      .data('q', q)
      .data('qbounds', qbounds)
  for (const i in results) {
    const item = results[i]
    if (!bounds) {
      bounds = L.latLngBounds(item.bbox)
    }
    bounds.extend(item.bbox)
    renderResult(item).prependTo(ul)
  }
  ul.appendTo('#body')
  $('html').scrollTop(0)
  if ($('#results li').length === 1) {
    // expand details if only one item
    $('#results li').click()
    return
  }
  if (bounds) {
    const zoomButton = $('<button id="zoom">')
      .text('Zoom to search results')
      .click(function () {
        map.fitBounds(bounds, { animate: true, duration: 1 })
      })
      .prependTo('#right-panel')
    if ($('#limitToMap').val()) {
      zoomButton.click()
    }
  }
}

function rankResults (results, bounds) {
  const limit = $('#limitToMap').is(':checked')
  if (!bounds) {
    bounds = map.getBounds()
  }
  const mx1 = bounds.getWest()
  const my1 = bounds.getSouth()
  const mx2 = bounds.getEast()
  const my2 = bounds.getNorth()
  const mapArea = (mx2 - mx1) * (my2 - my1)
  const resultList = []
  for (const i in results) {
    const item = results[i]
    const ix1 = item.bbox[0][1]
    const iy1 = item.bbox[0][0]
    const ix2 = item.bbox[1][1]
    const iy2 = item.bbox[1][0]
    const itemArea = (ix2 - ix1) * (iy2 - iy1)
    const intersectX = Math.min(mx2, ix2) - Math.max(mx1, ix1)
    const intersectY = Math.min(my2, iy2) - Math.max(my1, iy1)
    let intersectArea = 0
    if (intersectX < 0 || intersectY < 0) {
      // no overlap

      // omit from results?
      if (limit) continue

      // rank by distance to map bounds
      item._spatialscore = -1 * Math.sqrt(Math.pow(intersectX, 2) + Math.pow(intersectY, 2))
    } else {
      intersectArea = intersectX * intersectY
      item._spatialscore = intersectArea / mapArea * intersectArea / itemArea
    }
    resultList.push(item)
  }
  // sort lowest first
  resultList.sort(function (a, b) {
    return a._spatialscore > b._spatialscore ? 1 : -1
  })
  return resultList
}

function cssVar (name) {
  const body = window.getComputedStyle(document.querySelector('body'))
  return body.getPropertyValue(name)
}

function setupStyles () {
  styles.bbox = {
    color: cssVar('--map-bbox-color'),
    opacity: 0.3,
    weight: 1,
    fillColor: '#fff',
    fillOpacity: 0,
    isBbox: true
  }
  styles.bboxHighlight = {
    color: cssVar('--map-bbox-highlight-color'),
    opacity: 1,
    weight: 4,
    fillColor: cssVar('--map-bbox-highlight-color'),
    fillOpacity: 0.2
  }
  styles.featureHighlight = {
    color: cssVar('--map-feature-highlight-color'),
    opacity: 1,
    weight: 4,
    fillColor: cssVar('--map-feature-highlight-color'),
    fillOpacity: 0.2
  }
  styles.indexmap = {
    color: cssVar('--map-indexmap-color'),
    opacity: 1,
    weight: 0.5,
    fillColor: cssVar('--map-indexmap-color'),
    fillOpacity: 0.3
  }
  styles.unavailable = {
    color: cssVar('--map-indexmap-unavailable-color'),
    opacity: 1,
    weight: 0.5,
    fillColor: cssVar('--map-indexmap-unavailable-color'),
    fillOpacity: 0.3
  }
  styles.indexmapSelected = {
    color: cssVar('--map-indexmap-selected-color'),
    opacity: 1,
    weight: 2,
    fillColor: cssVar('--map-indexmap-selected-color'),
    fillOpacity: 0.3
  }
}

function renderResult (item) {
  const li = $('<li>').data('item', item)
  // $('<div>').text(item._spatialscore).appendTo(li);
  $('<a class="title">')
    .text(item.title)
    .attr('href', '#id=' + item.id)
    .appendTo(li)
  $('<div class="brief">').text(item.description).appendTo(li)
  itemDetails(item).appendTo(li)
  $('<span>').text(item.creator + '. ').prependTo(li.find('.description'))
  const bboxlayer = renderItemBbox(item)
  bboxlayer.options.li = li
  li.data('bbox', bboxlayer)
  return li
}

function renderItemBbox (item) {
  // add bbox to map
  const layer = L.rectangle(item.bbox, styles.bbox).addTo(map)
  return layer
}

function mouseoverResultItem (e) {
  const item = $(e.currentTarget)
  if ($('#results li.active').length > 0) {
    // ignore mouseover if any item is active (i.e. in detail view)
    return
  }
  const bbox = item.data('bbox')
  if (bbox) {
    bbox.setStyle(styles.bboxHighlight).bringToFront()
  }
}

function mouseoutResultItem (e) {
  const item = $(e.currentTarget)
  const bbox = item.data('bbox')
  bbox.setStyle(styles.bbox)
}

function backToSearch () {
  const q = $('#results').data('q')
  const qbounds = $('#results').data('qbounds')
  const scroll = $('#results').data('scroll') - 120
  $('#q').val(q)
  search(q, qbounds)
  $('html').scrollTop(scroll)
}

function clickResultItem (e) {
  if (e.ctrlKey) {
    // ctrl-click should open the link in a new window
    e.stopPropagation()
    const item = $(e.currentTarget).data('item')
    window.open('#id=' + item.id)
    return false
  }

  // check that we are not already viewing this item
  if ($(e.currentTarget).hasClass('active')) {
    return
  }

  // deactivate the item and remove any download subsets
  $('#results li.active')
    .removeClass('active')
    .find('.subsets, .allclear').html('')

  // activate the clicked item and show it
  const li = $(e.currentTarget).addClass('active').show()

  // remember current scroll position
  $('#results').data('scroll', li.offset().top)

  // go to top of page
  $('html').scrollTop(0)
  const item = li.data('item')

  // add cugir id to the URL hash
  go('id=' + item.id, item.title)

  // clear the map and hide all other results
  clearMap()
  $('#results li:not(.active)').hide()

  const nav = $('#nav')

  // $('<button id="backToSearch">')
  //  .text('Back to Search')
  //  .attr('href', '#'+ escapeForHash($('#results').data('q')))
  //  .appendTo(summary);

  $('.prev').remove()
  $('<button class="prev">')
    .text('« previous')
    .appendTo(nav)

  // remove any existing number
  $('.num').remove()

  // add number of current result
  const num = $('#results li').index(li) + 1
  $('<span class="num">').text(num + ' of ').prependTo('#nav')

  $('.next').remove()
  $('<button class="next">')
    .text('next »')
    .appendTo(nav)

  map.fitBounds(item.bbox, { animate: true, duration: 1, padding: [32, 32] })
  if (item.wms) {
    li.data('layer', wmsLayer(item))
  } else if (item.openindexmaps) {
    li.data('layer', openindexmapsLayer(item))
  } else {
    const bboxlayer = renderItemBbox(item)
    bboxlayer.setStyle(styles.unavailable)
  }
}

function wmsLayer (item) {
  const layer = L.tileLayer.wms(item.wms, {
    layers: item.layerid,
    format: 'image/png',
    transparent: true,
    tiled: true,
    maxZoom: 21 // default 18 is not enough
  })
  layer.addTo(map).bringToFront()
  return layer
}

function openindexmapsLayer (item) {
  const layer = new L.GeoJSON.AJAX(item.openindexmaps, {
    style: styles.indexmap,
    onEachFeature: function (feature, layer) {
      if (feature.properties.available === false) {
        layer.setStyle(styles.unavailable)
      }
      feature.layer = layer
      layer.bindTooltip(
        feature.properties.label || feature.properties.title,
        { sticky: true, direction: 'top' }
      )
    }
  })
  layer.addTo(map).bringToFront()
  return layer
}

function clickPrevButton () {
  const prev = $('#results li.active').prev()
  if (prev) {
    prev.click()
  }
}

function clickNextButton () {
  const next = $('#results li.active').next()
  if (next) {
    next.click()
  }
}

function clickMap (e) {
  // Does the map show an active item?
  const active = $('#results li.active')
  if (active.length > 0) {
    // Is it openindexmap, raster, or vector?
    if (active.data('item').openindexmaps) {
      clickIndexMap(e)
    } else if (active.data('item').geom_type === 'Raster') {
      clickRasterMap(e)
    } else {
      clickVectorMap(e)
    }
  } else if ($('#results li').length > 0) {
    // Does the map show result bboxes?
    clickResultsMap(e)
  }
}

function clickResultsMap (e) {
  // forget about any previously-clicked item
  const olditem = $('#results li.hover').removeClass('hover')
  if (olditem.length > 0) {
    olditem.data('bbox').setStyle(styles.bbox)
  }

  // highlight the clicked bbox and corresponding item
  const layer = map.getLayerAt(e.layerPoint)
  const li = layer.options.li.mouseover().addClass('hover')
  $('html').scrollTop(li.offset().top - 240)
  // move to back so that other results can be clicked
  layer.bringToBack()
}

function clickIndexMap (e) {
  const active = $('#results li.active')

  // get the clicked feature properties
  const features = leafletPip.pointInLayer(e.latlng, active.data('layer'))
  const feature = features[0].feature
  showAttributes(feature.properties)

  const subsets = $('#results li.active .subsets')
  const allclear = $('#results li.active .allclear')
  if (!(feature.properties.available && feature.properties.downloadUrl)) {
    return
  }
  if (feature.selection) {
    // deselect this feature
    feature.selection.remove()
    feature.download.remove()
    delete feature.selection
  } else {
    // highlight feature
    const layer = L.geoJSON(feature, {
      // display points as little circles
      pointToLayer: function (point, latlng) {
        return L.circleMarker(latlng, { color: cssVar('--map-feature-highlight-color') })
      },
      style: styles.indexmapSelected,
      isSelection: true
    }).addTo(map)
    feature.selection = layer

    // keep track of the download button so we can remove it later
    // if the feature is clicked again
    feature.download = subsetDownload(feature.properties)

    // add download button
    subsets.append(feature.download)
  }

  allclear.html('')
  if (subsets.children().length > 0) {
    $('<button id="clear-subsets">Clear selection</button>')
      .appendTo(allclear)
      .on('click', clearSelections)
  }
  if (subsets.children().length > 1) {
    allclear.append('<button id="download-all">Download all selected subsets</button>')
  }
}

function subsetDownload (p) {
  let name = p.label
  if (!name) name = p.title
  const a = $('<a>')
    .addClass('download')
    .attr('target', '_blank')
    .attr('href', p.downloadUrl)
    .text(name)
  return $('<li>').append(a)
}

function downloadAll () {
  $('.subsets .download').each(function (i, link) {
    const url = $(link).attr('href')
    // wait 500ms between downloads to keep the browser happy
    setTimeout(function () { window.location = url }, 500 * i)
  })
}

function clearSelections () {
  // remove everything from downloads section
  $('.allclear, .subsets').html('')
  // remove selections from map
  map.eachLayer(function (layer) {
    if (layer.options.isSelection) {
      if (layer.feature && layer.feature.selection) {
        layer.feature.selection.remove()
        delete layer.feature.selection
      }
      layer.remove()
    }
  })
  // remove attributes too
  $('#attr').remove()
}

function clickVectorMap (e) {
  const active = $('#results li.active')
  const item = active.data('item')

  // calc generous bbox for the clicked point (+/- 3 pixels)
  // otherwise it is difficult to click a point feature
  const bounds = map.getBounds()
  const pixelsize = (bounds._northEast.lat - bounds._southWest.lat) / map.getSize().y
  const x1 = e.latlng.lng - pixelsize * 3
  const x2 = e.latlng.lng + pixelsize * 3
  const y1 = e.latlng.lat - pixelsize * 3
  const y2 = e.latlng.lat + pixelsize * 3

  // https://cugir.library.cornell.edu/geoserver/cugirwfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=cugir008186&srsName=EPSG:4326&bbox=42.1634,-76.5687,42.1634,-76.5687&outputFormat=json
  const params = {
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: 'cugir:' + item.layerid,
    srs: 'EPSG:4326',
    bbox: [y1, x1, y2, x2].join(','),
    outputFormat: 'json'
  }
  // const url = item.wfs + L.Util.getParamString(params)
  // use a proxy to avoid CORS problem
  const url = 'https://alteriseculo.com/proxy/?url=' + encodeURIComponent(item.wfs + L.Util.getParamString(params))
  $.ajax({
    url: url,
    dataType: 'json',
    success: function (data, status, xhr) {
      if (data.features.length === 0) {
        // no features found
        return
      }

      // WFS bbox query returns potential matches (based on feature bbox)
      // so check for real point-in-polygon matches
      let match
      if (data.features[0].geometry.type.indexOf('Polygon') > -1) {
        const matches = leafletPip.pointInLayer(e.latlng, L.geoJSON(data), true)
        if (matches.length === 0) return
        // use first match only
        match = matches[0].feature
      } else {
        // use first match only
        // TODO show multiple matches
        match = data.features[0]
      }
      const properties = match.properties

      // remove any other selected features
      // since we only look at one feature's attributes at a time
      map.eachLayer(function (layer) {
        if (layer.options.isSelection) {
          layer.remove()
        }
      })

      // highlight feature and show attributes
      L.geoJSON(match, {
        // display any points as little circles
        pointToLayer: function (point, latlng) {
          return L.circleMarker(latlng, { color: cssVar('--map-feature-highlight-color') })
        },
        style: styles.featureHighlight,
        isSelection: true
      }).addTo(map)
      showAttributes(properties)
    },
    error: function (xhr, status, error) {
      console.log(xhr)
      console.log(status)
      console.log(error)
    }
  })
}

function clickRasterMap (e) {
  const item = $('#results li.active').data('item')
  const bounds = map.getBounds()
  const x1 = bounds._southWest.lng
  const x2 = bounds._northEast.lng
  const y1 = bounds._southWest.lat
  const y2 = bounds._northEast.lat
  const size = map.getSize()
  const params = {
    service: 'WMS',
    version: '1.1.1',
    request: 'GetFeatureInfo',
    layers: 'cugir:' + item.layerid,
    query_layers: 'cugir:' + item.layerid,
    srs: 'EPSG:4326',
    bbox: [x1, y1, x2, y2].join(','),
    width: size.x,
    height: size.y,
    info_format: 'application/json',
    x: parseInt(e.containerPoint.x),
    y: parseInt(e.containerPoint.y)
  }
  let url = item.wms + L.Util.getParamString(params)
  url = 'https://alteriseculo.com/proxy/?url=' + encodeURIComponent(url)
  $.ajax({
    url: url,
    dataType: 'json',
    success: function (data, status, xhr) {
      // remove any existing highlighted point
      map.eachLayer(function (layer) {
        if (layer.options.isSelection) {
          layer.remove()
        }
      })
      // show feature and attributes
      const layer = L.circleMarker(e.latlng, {
        style: styles.featureHighlight,
        isSelection: true,
        color: cssVar('--map-feature-highlight-color')
      }).addTo(map)
      const properties = data.features[0].properties
      const value = properties.GRAY_INDEX || properties.PALETTE_INDEX
      layer.bindTooltip('' + value, { permanent: true })
    },
    error: function (xhr, status, error) {
      console.log(xhr)
      console.log(status)
      console.log(error)
    }
  })
}

function showAttributes (properties) {
  $('#attr').remove()
  const info = $('<div id="attr">').appendTo('body')
  const table = $('<table>')
    .html('<tr class="head"><th colspan="2">Attributes<button class="close">X</button></th></tr>')
    .appendTo(info)
  // show all properties
  // custom view for new openindexmaps w/thumbnail, etc
  for (const p in properties) {
    const tr = $('<tr>').appendTo(table)
    $('<th>').text(p).appendTo(tr)
    let v = properties[p]
    if (p.match(/^thumb(nail)?Url$/)) {
      // display thumbnails
      v = $('<img>').attr('src', v)
    } else if (typeof (v) === 'string' && (v.startsWith('http') || v.startsWith('ftp'))) {
      // linkify URLs
      v = $('<a>')
        .attr('href', v)
        .attr('target', '_blank')
        .text(v)
    }
    if (v === false) {
      v = 'false'
    }
    $('<td>').html(v).appendTo(tr)
  }
}

function itemDetails (item) {
  const details = $('<div class="details">')
  const table = $('<table>').appendTo(details)
  const properties = [
    'author',
    'description',
    'collection',
    'place',
    'category',
    'subject',
    'year'
  ]
  for (let i = 0; i < properties.length; i++) {
    const p = properties[i]
    const v = item[p]
    if (!v) continue
    const tr = $('<tr>').appendTo(table)
    $('<th>').text(p).appendTo(tr)
    $('<td>').html(linkify(p, v)).appendTo(tr)
  }

  // METADATA
  let tr = $('<tr>').appendTo(table)
  $('<th>').text('more details').appendTo(tr)
  let td = $('<td>').appendTo(tr)
  $('<a>').attr('href', item.metadata).attr('target', '_blank').text('metadata').appendTo(td)

  // DOWNLOAD
  tr = $('<tr>').prependTo(table)
  $('<th>').text('download').appendTo(tr)
  td = $('<td>').appendTo(tr)
  td.append(downloadSection(item))

  // ALERT IF NO WMS IMAGE IS AVAILABLE
  if (!item.wms && !item.openindexmaps) {
    tr = $('<tr class="alert">').prependTo(table)
    $('<th>').text('note').appendTo(tr)
    $('<td>').text('Map previews are not available for the ' + item.format + ' file format.')
      .appendTo(tr)
  }

  return details
}

function downloadSection (item) {
  const div = $('<div class="downloads">')
  const isIndexMap = item.category.indexOf('index map') > -1

  // main download file
  let format = item.format
  if (format.slice(-4) !== 'file') {
    format += ' file'
  }
  if (isIndexMap) {
    format += ' (index map)'
  }
  $('<a>')
    .addClass('download')
    .attr('target', '_blank')
    .attr('href', item.download)
    .text(format)
    .appendTo(div)
  div.append(item.filesize + ' ')

  if (isIndexMap) {
    $('<p class="alert">')
      .text('This is an index map.  Please select features on the map to get the download links for the actual data.')
      .appendTo(div)
    $('<div class="allclear">').appendTo(div)
    $('<ul class="subsets">').appendTo(div)
  }

  // addl_downloads
  if (Object.keys(item.addl_downloads).length > 0) {
    div.append('<br>')
    for (const k in item.addl_downloads) {
      $('<a>')
        .addClass('download')
        .attr('target', '_blank')
        .attr('href', item.addl_downloads[k])
        .text(k)
        .appendTo(div)
    }
  }

  return div
}

function linkify (p, v) {
  // linkify specific fields
  if (config.linkify.indexOf(p) > -1) {
    // make sure v is an array
    if (!Array.isArray(v)) {
      v = [v]
    }
    const div = $('<div>')
    let count = 0
    for (let i = 0; i < v.length; i++) {
      const vi = v[i]
      if (count++) {
        div.append(', ')
      }
      $('<a>')
        .text(vi)
        .attr('href', '#' + p + '="' + vi + '"')
        .click(clickLink)
        .appendTo(div)
    }
    return div
  } else if (Array.isArray(v)) {
    return v.join(', ')
  }

  let max = config.moreLength
  if (typeof (v) === 'string' && v.length > (max * 1.3)) {
    // adjust max to chop at a space
    max = v.indexOf(' ', max - 16)
    const more = v.substr(max)
    v = v.substr(0, max) +
      "<button class='more'>more</button>" +
      "<span class='more'>" + more + '<span>'
  }
  return v
}

function stats (property) {
  const seen = {}
  for (let i = 0; i < cugirjson.length; i++) {
    const item = cugirjson[i]
    const value = item[property]
    for (let j = 0; j < value.length; j++) {
      const valuej = value[j]
      if (typeof seen[valuej] !== 'undefined') {
        seen[valuej] += 1
      } else {
        seen[valuej] = 1
      }
    }
  }
  return seen
}
