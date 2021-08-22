/* global $ L leafletPip Sift filter cugirjson:writeable setupConfig */

let config
let s

$(document).ready(function () {
  s = new Sift({
    config: setupConfig(),
    dataSource: 'data/cugir.json',
    resultsDiv: 'left-panel',
    mapDiv: 'map'
  })
  waitForData()
  $(document).on('click', 'img#logo', home)
  $(document).on('click', '#results li', clickResultItem)
  $(document).on('click', 'button.prev', clickPrevButton)
  $(document).on('click', 'button.next', clickNextButton)
  $(document).on('click', '#backToSearch', backToSearch)
  $(document).on('click', '#resetButton', home)
  $(document).on('click', 'button.more', showMore)
  $(document).on('click', '#attr button.close', clearSelections)
  $(document).on('click', '#download-all', downloadAll)
  $(document).on('change', '#limitToMap', updateMapLimit)
  $(document).on('submit', 'form#search', function (e) {
    const q = $('#q').val()
    const qbounds = s.map.leaflet.getBounds()
    s.search(q, qbounds)
    e.preventDefault()
  })
  $(document).on('mouseover', '#results > li', mouseoverResultItem)
  $(document).on('mouseout', '#results > li', mouseoutResultItem)
  $(document).on('keydown', listenForKeys)
  window.onhashchange = function () {
    // determine if browser back/forward buttons are clicked and if so...
    // interpretHash()
  }
})

// TODO have the UI set something like s.config.limitToMap
function updateMapLimit() {
  s.config.limitToMap = $('#limitToMap').is(':checked')
}

function waitForData () {
  if (!s.data) {
    window.setTimeout(function () { waitForData() }, 100)
  } else {
    interpretHash()
  }
}

function interpretHash () {
  const hash = window.location.hash
  if (hash) {
    // search for whatever is after the #
    s.search(unescapeHash(hash.slice(1)))
  } else {
    home()
  }
}

function home () {
  go('', 'CUGIRjs home')
  $('#q').val('')
  $('#summary').html('')
  s.map.clear()
  s.map.leaflet.fitBounds(s.config.homeBounds)
  $('#left-panel').html(
    '<div class="home">' +
      '<h1>Welcome to CUGIR!</h1>' +
      '<p>Explore and discover New York State geospatial data:</p>' +
      '<ul id="categories"></ul>' +
      '<p class="alert">' +
      'This is an EXPERIMENTAL javascript interface to <a href="https://cugir.library.cornell.edu/">CUGIR</a>.' +
      '</p>' +
    '</div>'
  )
  // list all categories (and the number of datasets for each)
  const catstat = s.stats(s.data, 'category')
  let categories = Object.keys(catstat)
  categories = categories.sort(function (a, b) {
    if (a < b) return -1
    else if (a > b) return 1
    else return 0
  })
  for (let i = 0; i < categories.length; i++) {
    const li = $('<li>').appendTo('#categories')
    $('<a>')
      .text(categories[i])
      .attr('href', '#category="' + categories[i] + '"')
      .click(_clickLink)
      .appendTo(li)
    $('<span class="count">').html('&nbsp;(' + catstat[categories[i]] + ') ')
      .appendTo(li)
  }
}

function listenForKeys (e) {
  if (e.key === 'Escape') {
    clearSelections()
  } else if (e.key === 'PageDown') {
    clickNextButton()
  } else if (e.key === 'PageUp') {
    clickPrevButton()
  } else if (e.key === 'Enter') {
    $('#results li.hover').click()
  }
}

function go (hash, title) {
  window.location.hash = hash
  document.title = title
}

function showMore (e) {
  $(e.target).hide()
  $(e.target).next().show()
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

function mouseoverResultItem (e) {
  const item = $(e.currentTarget)
  if ($('#results li.active').length > 0) {
    // ignore mouseover if any item is active (i.e. in detail view)
    return
  }
  $('#results li.hover').each(function (i, olditem) {
    olditem = $(olditem)
    olditem.removeClass('hover')
    const bbox = olditem.data('bbox')
    if (bbox) {
      bbox.setStyle(s.config.mapStyles.bbox)
    }
  })
  item.addClass('hover')
  const bbox = item.data('bbox')
  if (bbox) {
    bbox.setStyle(s.config.mapStyles.bboxHighlight).bringToFront()
  }
}

function mouseoutResultItem (e) {
  const item = $(e.currentTarget)
  const bbox = item.data('bbox')
  if (bbox) {
    bbox.setStyle(s.config.mapStyles.bbox)
  }
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
  s.map.clear()
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

  s.map.leaflet.fitBounds(item.bbox, { animate: true, duration: 1, padding: [32, 32] })
  if (item.wms) {
    li.data('layer', wmsLayer(item))
  } else if (item.openindexmaps) {
    li.data('layer', openindexmapsLayer(item))
  } else {
    const bboxlayer = renderItemBbox(item)
    bboxlayer.setStyle(config.mapStyles.unavailable)
  }
}

function wmsLayer (item) {
  const url = item.wms
  const options = {
    layers: item.layerid,
    format: 'image/png',
    transparent: true,
    tiled: true,
    maxZoom: 21 // default 18 is not enough
  }
  if (cssVar('--dark') && url.match(/cugir/) && item.geom_type.match(/point|line|polygon/i)) {
    options.styles = 'darkmode-' + item.geom_type
  }
  const layer = L.tileLayer.wms(url, options)
  layer.addTo(s.map.leaflet).bringToFront()
  return layer
}

function openindexmapsLayer (item) {
  const url = item.openindexmaps
  const layer = new L.GeoJSON.AJAX(url, {
    style: config.mapStyles.indexmap,
    onEachFeature: function (feature, layer) {
      if (feature.properties.available === false) {
        layer.setStyle(config.mapStyles.unavailable)
      }
      feature.layer = layer
      layer.bindTooltip(
        feature.properties.label || feature.properties.title,
        { sticky: true, direction: 'top' }
      )
    }
  })
  layer.addTo(s.map.leaflet).bringToFront()
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
    olditem.data('bbox').setStyle(config.mapStyles.bbox)
  }

  // highlight the clicked bbox and corresponding item
  const layer = map.getLayerAt(e.layerPoint)
  const li = layer.options.li.mouseover()
  $('html').scrollTop(li.offset().top - 240)
  // move to back so that other results can be clicked
  layer.bringToBack()
}

function clickIndexMap (e) {
  const active = $('#results li.active')

  // get the clicked feature properties
  const features = leafletPip.pointInLayer(e.latlng, active.data('layer'))
  if (features.length === 0) {
    // no features found at the clicked point
    return false
  }
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
      style: config.mapStyles.indexmapSelected,
      isSelection: true
    }).addTo(s.map.leaflet)
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
  const params = {
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: item.layerid,
    srs: 'EPSG:4326',
    bbox: [y1, x1, y2, x2].join(','),
    outputFormat: 'json'
  }
  const url = item.wfs + L.Util.getParamString(params)

  /* TODO try WMS if WFS fails
  params = {
    service: 'WMS',
    version: '1.1.1',
    request: 'GetFeatureInfo',
    layers: item.layerid,
    query_layers: item.layerid,
    srs: 'EPSG:4326',
    bbox: [x1, y1, x2, y2].join(','),
    x: 3,
    y: 3,
    width: 7,
    height: 7,
    info_format: 'application/json'
  }
  url = item.wms + L.Util.getParamString(params)
  */

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
        style: config.mapStyles.featureHighlight,
        isSelection: true
      }).addTo(s.map.leaflet)
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
  const url = item.wms + L.Util.getParamString(params)
  // url = 'https://alteriseculo.com/proxy/?url=' + encodeURIComponent(url)
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
        style: config.mapStyles.featureHighlight,
        isSelection: true,
        color: cssVar('--map-feature-highlight-color')
      }).addTo(s.map.leaflet)
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
    let link = false
    if (p.match(/^thumb(nail)?Url$/)) {
      // display thumbnails
      v = $('<img>').attr('src', v)
    } else if (typeof (v) === 'string' && (v.startsWith('http') || v.startsWith('ftp'))) {
      // linkify URLs
      link = true
      v = $('<a>')
        .attr('href', v)
        .attr('target', '_blank')
        .text(v)
    }
    if (v === false) {
      v = 'false'
    }
    const td = $('<td>').html(v).appendTo(tr)
    if (link) {
      td.addClass('url')
    }
  }
}
