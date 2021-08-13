/* global $ L leafletPip filter */
let map

$(document).ready(function () {
  cugirjson = cleanData(cugirjson)
  map = setupMap()
  $(document).on('click', 'img#logo', home)
  $(document).on('click', '#results li', clickResultItem)
  $(document).on('click', 'button.prev', clickPrevButton)
  $(document).on('click', 'button.next', clickNextButton)
  $(document).on('click', '#backToSearch', backToSearch)
  $(document).on('click', '#resetButton', home)
  $(document).on('click', 'button.more', showMore)
  $(document).on('click', '#info button.close', closeInfo)
  $(document).on('submit', 'form#search', submitQuery)
  $(document).on('mouseover', '#results li', mouseoverResultItem)
  $(document).on('mouseout', '#results li', mouseoutResultItem)
  $(document).on('keydown', listenForKeys)
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
    closeInfo()
  } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
    clickNextButton()
  } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    clickPrevButton()
  }
}

function closeInfo () {
  $('#info').remove()
  $('#body').removeClass('info')
}

function setupMap () {
  map = L.map('map', {
    fadeAnimation: false
  })
  // zoom to NYS
  map.fitBounds([[40.5, -80], [45, -71.8]])
  L.tileLayer.colorFilter('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
    isBasemap: true,
    maxZoom: 21,
    opacity: 1,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://carto.com/location-data-services/basemaps/">Carto</a>',
    filter: [
      'brightness:75%',
      'contrast:200%',
      'saturate:200%'
    ]
  }).addTo(map)
  map.on('click', clickMap)
  return map
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

function home () {
  window.location.hash = ''
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
      '<p>Explore and discover New York State data and metadata related to:</p>' +
      '<ul id="categories"></ul>' +
      '<p style="margin:4em ; color:#fff ; background:#f00 ; padding:1em">This is an EXPERIMENTAL javascript interface to <a href="https://cugir.library.cornell.edu/" style="color:#fc0 ; font-weight:bold ; text-decoration:underline">CUGIR</a>.</p>' +
    '</div>'
  )
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
  closeInfo()
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
  window.location.hash = escapeForHash(q)
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

const defaultStyle = {
  color: '#222',
  opacity: 0.3,
  weight: 1,
  fillColor: '#fff',
  fillOpacity: 0,
  isBbox: true
}

const activeStyle = {
  color: '#00f',
  opacity: 0.7,
  weight: 5,
  fillColor: '#88f',
  fillOpacity: 0.5
}

const selectedStyle = {
  color: '#00f',
  opacity: 0.7,
  weight: 5,
  fillColor: '#00f',
  fillOpacity: 0.5
}

const unavailableStyle = {
  color: '#f00',
  opacity: 0.7,
  weight: 2,
  fillColor: '#f88',
  fillOpacity: 0.5
}

const indexmapStyle = {
  color: '#080',
  opacity: 0.7,
  weight: 2,
  fillColor: '#080',
  fillOpacity: 0.5
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
  const layer = L.rectangle(item.bbox, defaultStyle).addTo(map)
  return layer
}

function mouseoverResultItem (e) {
  const item = $(e.currentTarget)
  if ($('#results li.active').length > 0) {
    // ignore mouseover if any item is active (in detail view)
    return
  }
  const bbox = item.data('bbox')
  if (bbox) {
    bbox.setStyle(activeStyle).bringToFront()
  }
}

function mouseoutResultItem (e) {
  const item = $(e.currentTarget)
  const bbox = item.data('bbox')
  bbox.setStyle(defaultStyle)
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
  // check that we are not already viewing this item
  if ($(e.currentTarget).hasClass('active')) {
    return
  }

  // clear the selection
  $('#results li.active').removeClass('active')

  // select the clicked item and show it
  const li = $(e.currentTarget).addClass('active').show()

  // remember current scroll position
  $('#results').data('scroll', li.offset().top)

  // go to top of page
  $('html').scrollTop(0)
  const item = li.data('item')

  // add cugir id to the URL hash
  window.location.hash = 'id=' + item.id

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

  map.fitBounds(item.bbox, { animate: true, duration: 1 })
  if (item.wms) {
    var layer = L.tileLayer.wms(item.wms, {
      layers: item.layerid,
      format: 'image/png',
      transparent: true,
      tiled: true,
      maxZoom: 21 // default 18 is not enough
    })
    li.data('layer', layer)
    layer.addTo(map).bringToFront()
  } else if (item.openindexmaps) {
    layer = new L.GeoJSON.AJAX(item.openindexmaps, {
      style: indexmapStyle,
      onEachFeature: eachIndexMapFeature
    })
    li.data('layer', layer)
    layer.addTo(map).bringToFront()
  } else {
    const bboxlayer = renderItemBbox(item)
    bboxlayer.setStyle(unavailableStyle)
  }
}

function eachIndexMapFeature (feature, layer) {
  if (feature.properties.available === false) {
    layer.setStyle(unavailableStyle)
  } else {
    layer.setStyle(indexmapStyle)
  }
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
    olditem.data('bbox').setStyle(defaultStyle)
  }

  // highlight the clicked bbox and corresponding item
  const layer = map.getLayerAt(e.layerPoint)
  const li = layer.options.li.mouseover().addClass('hover')
  $('html').scrollTop(li.offset().top - 128)
  // move to back so that other results can be clicked
  layer.bringToBack()
}

function clickIndexMap (e) {
  const active = $('#results li.active')
  if (active.length < 1) {
    console.log('this should never happen in clickIndexMap()')
  }
  const features = leafletPip.pointInLayer(e.latlng, active.data('layer'))
  const feature = features[0].feature
  const properties = feature.properties
  const subsets = $('#results li.active .subsets')
  if (properties.downloadUrl != 'no data') {
    if (subsets.children().length === 0) {
      // If this is the first selected subset, add text before
      subsets.append('Selected data subsets:<br>')
    }
    // add subset download button
    if (properties.downloadUrl) {
      subsets.append(subsetDownload(properties))
        .append(' ')
    }
    // add download-all button if more than one subset
    if (subsets.children().length > 1) {
      const d = document.getElementById('download-all')
      if (d) {
        d.remove()
      }
      subsets.append('<button id="download-all" onclick="downloadAll()">Download all selected subsets</button>')
    }
  }
  // show feature and info
  const layer = L.geoJSON(feature, {
    // display points as little circles
    pointToLayer: function (point, latlng) {
      return L.circleMarker(latlng)
    },
    style: selectedStyle,
    isSelection: true
  }).addTo(map)
  if (!properties.downloadUrl) {
    layer.setStyle(unavailableStyle)
  }
  showInfo(properties)
}

function downloadAll () {
  $('.subsets .download').each(function (i, link) {
    const url = $(link).attr('href')
    // wait 500ms between downloads to keep the browser happy
    setTimeout(function () { window.location = url }, 500 * i)
  })
}

function clickVectorMap (e) {
  const active = $('#results li.active')
  // make sure we have a wms layer
  if (active.length < 1) return
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
  params = {
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: 'cugir:' + item.layerid,
    srs: 'EPSG:4326',
    bbox: [y1, x1, y2, x2].join(','),
    outputFormat: 'json'
  }
  const url = 'https://alteriseculo.com/proxy/?url=' + encodeURIComponent(item.wfs + L.Util.getParamString(params))
  $.ajax({
    url: url,
    dataType: 'json',
    success: function (data, status, xhr) {
      if (data.features.length == 0) {
        // no features found
        return
      }

      // WFS bbox query returns potential matches (based on feature bbox)
      // so check for real point-in-polygon matches
      let match
      if (data.features[0].geometry.type.indexOf('Polygon') > -1) {
        const matches = leafletPip.pointInLayer(e.latlng, L.geoJSON(data), true)
        if (matches.length == 0) return
        // use first match only
        match = matches[0].feature
      } else {
        // use first match only
        // TODO show multiple matches
        match = data.features[0]
      }
      const properties = match.properties

      // is this for an index map?
      // TODO move this to the openindexmap handler
      const subset = $('#results li.active .subset')
      if (subset.length > 0) {
        if (properties.download != 'no data') {
          // add text before the first selected subset
          if (subset.children().length == 0) {
            subset.append('Selected data subsets:<br>')
          }
          // add subset download button
          subset
            .append(subsetDownload(properties))
            .append(' ')
        }
      } else {
        // if not an index map, remove any other selected features
        map.eachLayer(function (layer) {
          if (layer.options.isSelection) {
            layer.remove()
          }
        })
      }

      // show feature and info
      const layer = L.geoJSON(match, {
        // display points as little circles
        pointToLayer: function (point, latlng) {
          return L.circleMarker(latlng)
        },
        style: activeStyle,
        isSelection: true
      }).addTo(map)
      if (properties.download == 'no data') {
        layer.setStyle(unavailableStyle)
      }
      showInfo(properties)
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
  params = {
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
      // show feature and info
      const layer = L.circleMarker(e.latlng, {
        style: activeStyle,
        isSelection: true
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

function showInfo (properties) {
  $('#body').addClass('info')
  $('#info').remove()
  const info = $('<div id="info">').appendTo('body')
  const table = $('<table>')
    .html('<tr class="head"><th>Attribute</th><th>Value<button class="close">X</button></th></tr>')
    .appendTo(info)
  for (const p in properties) {
    const tr = $('<tr>').appendTo(table)
    $('<th>').text(p).appendTo(tr)
    let v = properties[p]
    // linkify urls
    if (typeof (v) === 'string' && (v.startsWith('http') || v.startsWith('ftp'))) {
      v = $('<a>')
        .attr('href', v)
        .attr('target', '_blank')
        .text(v)
    }
    $('<td>').html(v).appendTo(tr)
  }
}

function subsetDownload (p) {
  // TODO simplify this by switching to standard openindexmaps properties
  const label = p.label
  const a = $('<a>')
    .addClass('download')
    .attr('target', '_blank')
    .attr('href', p.downloadUrl)
    .text(label)
  return a
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
    var tr = $('<tr>').appendTo(table)
    $('<th>').text(p).appendTo(tr)
    var td = $('<td>').html(linkify(p, v)).appendTo(tr)
  }

  // METADATA
  var tr = $('<tr>').appendTo(table)
  $('<th>').text('more details').appendTo(tr)
  var td = $('<td>').appendTo(tr)
  $('<a>').attr('href', item.metadata).attr('target', '_blank').text('metadata').appendTo(td)

  // DOWNLOAD
  var tr = $('<tr>').prependTo(table)
  $('<th>').text('download').appendTo(tr)
  var td = $('<td>').appendTo(tr)
  td.append(downloadSection(item))

  // ALERT IF NO WMS IMAGE IS AVAILABLE
  if (!item.wms && !item.openindexmaps) {
    var tr = $('<tr class="alert">').prependTo(table)
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
  $('<a>')
    .addClass('download')
    .attr('target', '_blank')
    .attr('href', item.download)
    .text(item.format + (isIndexMap ? ' (index map)' : ''))
    .appendTo(div)
  div.append(item.filesize + ' ')

  if (isIndexMap) {
    $('<p class="alert">')
      .text('This is an index map.  Please select features on the map to get the download links for the actual data.')
      .appendTo(div)
    $('<div class="subsets">').appendTo(div)
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

  // skip the generated downloads for now
  return div

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

  return div
}

function linkify (p, v) {
  // linkify certain fields
  // TODO move to config
  if (p === 'collection' || p === 'category' || p === 'place') {
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
  // TODO move max length to config
  let max = 600
  if (typeof (v) === 'string' && v.length > (max + 300)) {
    // adjust max to chop at a space
    max = v.indexOf(' ', max - 10)
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
