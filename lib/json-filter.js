function filter(objects, query) {
  // filter the data, returning just those objects that match the query

  // convert the query into filters
  var filters = [];
  var qterms = queryTerms(query);
  for (var i=0; i<qterms.length; i++) {
    var qt = qterms[i];
    var m = qt.match(/^(-?)(?:([_a-z][\w.-]*)(:|=|!=|<>|<=?|>=?))?(.*)$/i);
    var not = m[1];
    var property = m[2];
    var operator = m[3];
    var term = m[4];
    // Convert to all lowercase (for case-insensitive searching)
    term = term.toLowerCase();

    var re = new RegExp(('\\b' + term).replace('*', '.*') + '\\b', 'i');
    // convert numeric strings to numbers
    if (! isNaN(term) && term.length > 0) {
      term = +term;
    }
    if (operator==='!=' || operator==='<>') {
      not = '-';
      operator = '=';
    }
    filters.push({"not":not, "property":property, "operator":operator, "term":term, "regexp":re });
  }

  // loop through objects, and match those that pass all filters
  var matches = {};
  for (var id in objects) {
    var keep = true;
    var r = objects[id];
    for (var i=0; i<filters.length; i++) {
      var f = filters[i];
      if (typeof f.property === 'undefined') {
        // simple unfielded term
        if (! f.regexp.test(fulltext(r).normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) {
          keep = false;
        }
      }
      else {
        // fielded search
        var op = f.operator;
        var v = r[f.property];
        if (typeof v === 'string') {
          // always treat ids as numbers
          if (f.property === 'id') {
            v = +v;
          }
          // string comparisons are case- and diacritic-insensitive
          else {
            v = v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          }
        }
        if (op === ':') {
          // this will work even if v is an array of values,
          // since .test(v) silently converts v to a string
          if (! f.regexp.test(v)) {
            keep = false;
          }
        }
        else if (op === '=') {
          // if an array of values, keep=true if any match
          if (Array.isArray(v)) {
            keep = false;
            for (var j=0; j<v.length; j++) {
              if (v[j].toLowerCase() === f.term) {
                keep = true;
                break;
              }
            }
          }
          else if (f.term === "") {
            if (v === "" || v === null || v === undefined) {
              keep = true;
            }
            else {
              keep = false;
            }
          }
          else if (v !== f.term) {
            keep = false;
          }
        }
        else if (op === '>') {
          // if an array of values, test the max value
          if (Array.isArray(v)) {
            v = max(v);
          }
          // note that we compare strings if types differ
          if (
            v === undefined
            || v === null
            || v === ''
            || typeof(v)===typeof(f.term) && v <= f.term
            || typeof(v)!==typeof(f.term) && ''+v <= ''+f.term
          ) {
            keep = false;
          }
        }
        else if (op === '>=') {
          // if an array of values, test the max value
          if (Array.isArray(v)) {
            v = max(v);
          }
          // note that we compare strings if types differ
          if (
            v === undefined
            || v === null
            || v === ''
            || typeof(v)==typeof(f.term) && v < f.term
            || typeof(v)!==typeof(f.term) && ''+v < ''+f.term
          ) {
            keep = false;
          }
        }
        else if (op === '<') {
          // if an array of values, test the min value
          if (Array.isArray(v)) {
            v = min(v);
          }
          // note that we compare strings if types differ
          if (
            v === undefined
            || v === null
            || v === ''
            || typeof(v)==typeof(f.term) && v >= f.term
            || typeof(v)!==typeof(f.term) && ''+v >= ''+f.term
          ) {
            keep = false;
          }
        }
        else if (op === '<=') {
          // if an array of values, test the min value
          if (Array.isArray(v)) {
            v = min(v);
          }
          // note that we compare strings if types differ
          if (
            v === undefined
            || v === null
            || v === ''
            || typeof(v)==typeof(f.term) && v > f.term
            || typeof(v)!==typeof(f.term) && ''+v > ''+f.term
          ) {
            keep = false;
          }
        }
      }
      if (f.not) {
        keep = ! keep;
      }
      if (! keep) {
        // if one filter condition fails, skip to next object
        break;
      }
    }
    if (keep) {
      matches[id] = r;
    }
  }
  return matches;
}

function fulltext(obj) {
  // return string of all the obj's property values
  var texts = Object.keys(obj).reduce(function(r,v) {
    return r.concat(obj[v]);
  }, []);
  // note that we end with a space, so users can search for whole words, by adding space at the end of search term
  return texts.join(' ') + ' ';
}

function queryTerms(q) {
  // parse q and return array of separate query terms
  // example:  kgj time:7/8 key:"g minor" =>
  //           ["kgj", "time:7/8", "key:g minor"

  // check for empty query
  q = q.trim();
  if (q.length==0) {
    return [];
  }

  // Remove any unnecessary quotes from around single words
  q = q.replace(/"(\w+)"/, '$1');

  var q2 = '';
  var inquote = 0;
  for (var i=0; i<q.length; i++) {
    var char = q[i];
    if (char === '"') {
      inquote = 1 - inquote;
      //q2 += char;
    }
    else if (! inquote && char === ' ') {
      // use tab character to separate terms
      q2 += "\t";
    }
    else {
      q2 += char;
    }
  }
  var qterms = q2.trim().replace(/ +/, ' ').split(/\t+/);
  return qterms;
}


