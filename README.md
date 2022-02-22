# cugirjs

CUGIR as a simple javascript app

All data is loaded at start, from a local copy of [this solr query](http://cugir-prod-solr.internal.library.cornell.edu:8983/solr/geoblacklight/select?facet.field=cugir_category_sm&facet.field=dc_creator_sm&facet.field=dct_isPartOf_sm&facet.field=dct_spatial_sm&facet.field=layer_geom_type_s&facet.field=solr_year_i&facet.limit=1000&fl=dc_title_s%2Cdc_description_s%2Cdct_references_s%2Ccugir_addl_downloads_s%2Clayer_id_s%2Clayer_slug_s%2Cdc_type_s%2Cdc_format_s%2Ccugir_filesize_s%2Clayer_geom_type_s%2Clayer_modified_dt%2Cdc_creator_sm%2Cdc_publisher_s%2Cdc_subject_sm%2Ccugir_category_sm%2Cdct_spatial_sm%2Cdct_issued_s%2Cdct_temporal_sm%2Cdct_isPartOf_sm%2Csolr_geom%2Csolr_year_i&q=*%3A*&rows=1000) (link access requires VPN)

All interactions are handled in-browser, with no further requests to the server, except for WMS previews, index maps GeoJSON, and downloads.
