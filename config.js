/* global */

function setupConfig (s) {
  // this function should only get called after whole document (including css) is ready
  // TODO After we drop cssVar(), this can just be a simple object assignment
  return {

    // limit search results to datasets overlapping current map view?
    limitToMap: false,

    homeHtml: `
      <div class="home">
        <p class="alert">
          This is an EXPERIMENTAL javascript interface to
          <br>
          <a href="https://cugir.library.cornell.edu/">the original CUGIR website</a>.
        </p>
        <h1>Welcome to CUGIR!</h1>
        <p>Explore and discover New York State geospatial data:</p>
      </div>`,

    solr2sift: function (doc) {
      // convert solr doc to sift doc (with simpler field names)

      // some GBL solr fields are escaped json strings, due to solr limitations
      doc.dct_references_s = JSON.parse(doc.dct_references_s || '{}')
      doc.cugir_addl_downloads_s = JSON.parse(doc.cugir_addl_downloads_s || '{}')

      const doc2 = {
        id: doc.layer_slug_s,
        title: doc.dc_title_s,
        author: doc.dc_creator_sm || [],
        publisher: doc.dc_publisher_sm || [],
        description: doc.dc_description_s || '',
        collection: doc.dct_isPartOf_sm || [],
        category: doc.cugir_category_sm || [],
        subject: doc.dc_subject_sm || [],
        place: doc.dct_spatial_sm || [],
        year: doc.dct_temporal_sm || [],
        format: doc.dc_format_s || '',
        geom_type: doc.layer_geom_type_s || '',
        filesize: doc.cugir_filesize_s || '',
        metadata: doc.dct_references_s['http://www.w3.org/1999/xhtml'] || '',
        layerid: doc.layer_id_s || '',
        wms: doc.dct_references_s['http://www.opengis.net/def/serviceType/ogc/wms'] || '',
        wfs: doc.dct_references_s['http://www.opengis.net/def/serviceType/ogc/wfs'] || '',
        openindexmaps: doc.dct_references_s['https://openindexmaps.org'] || '',
        download: doc.dct_references_s['http://schema.org/downloadUrl'] || '',
        addl_downloads: doc.cugir_addl_downloads_s,
        bbox: solr2leafletBbox(doc.solr_geom || doc.locn_geometry),
        institution: doc.dct_provenance_s || ''
      }
      return doc2
    },

    // show these properties first in detail view
    firstProperties: [
      'author',
      'description',
      'collection',
      'place',
      'category',
      'subject',
      'year',
      'filesize'
    ],

    // hide these properties from detail view
    // (properties starting with _ will automatically be hidden)
    hiddenProperties: [
      'id',
      'title',
      'download',
      'addl_downloads',
      'metadata',
      'wms',
      'wfs',
      'layerid',
      'openindexmaps',
      'bbox'
    ],

    // automatically link values of these fields to a search query
    linkify: [
      'collection',
      'category',
      'place',
      'author'
    ],

    // field display will be limited to this many characters
    // (with a link to view 'more')
    moreLength: 800,

    // default zoom to NYS
    homeBounds: [[40.5, -80], [45, -71.8]],

    // list of available color modes
    // -- any additional modes should be defined in MapStyle (below)
    //    and/or in body.modename in the .css file
    modes: ['default', 'dark'],

    mode: 'dark',

    mapStyle: {
      default: {
        basemap: {
          url: 'https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png',
          options: {
            isBasemap: true,
            maxZoom: 21,
            opacity: 1,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://carto.com/location-data-services/basemaps/">Carto</a>',
            filter: [
              'brightness:75%',
              'contrast:200%',
              'saturate:200%'
            ]
          }
        },
        bbox: {
          color: '#222',
          opacity: 0.3,
          weight: 1.5,
          fillOpacity: 0,
          isBbox: true
        },
        highlight: {
          color: '#00c',
          opacity: 1,
          weight: 4,
          fillColor: '#88f',
          fillOpacity: 0.3,
          radius: 10
        },
        indexmap: {
          color: '#000',
          opacity: 1,
          weight: 0.5,
          fillColor: '#000',
          fillOpacity: 0.3
        },
        unavailable: {
          color: '#f00',
          opacity: 1,
          weight: 0.5,
          fillColor: '#f00',
          fillOpacity: 0.3
        },
        indexmapSelected: {
          color: '#00f',
          opacity: 1,
          weight: 2,
          fillColor: '#00f',
          fillOpacity: 0.3
        }
      },
      // modes other than default will inherit the default values
      // and 2nd-order properties (like bbox.color) will be overwritten
      dark: {
        basemap: {
          url: 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png',
          options: {
            isBasemap: true,
            maxZoom: 21,
            opacity: 1,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://carto.com/location-data-services/basemaps/">Carto</a>',
            filter: [
              'brightness:250%',
              'contrast:100%'
            ]
          }
        },
        bbox: {
          color: '#fff'
        },
        highlight: {
          color: '#ff0',
          fillColor: '#ff0'
        },
        indexmap: {
          color: '#fff',
          fillColor: '#fff'
        },
        indexmapSelected: {
          color: '#ff0',
          fillColor: '#ff0'
        }
      }
    }
  }
}

function solr2leafletBbox (solrGeom) {
  // return leaflet bbox for solr_geom values
  // ENVELOPE(minx, maxx, maxy, miny) => [ [miny, minx], [maxy,maxx] ]
  const m = solrGeom.match(/(-?\d+\.?\d*)/g)
  return [
    [parseFloat(m[3]), parseFloat(m[0])],
    [parseFloat(m[2]), parseFloat(m[1])]
  ]
}
