var tap = require("tap")
  , readEntry = require("../index.js").readEntry
  , fs = require("fs")
  , path = require("path")
  , fxs = require("./fixtures/fixtures.js")
  , i = 0
  , tarball
  , entryList
  , currTest

function readNextItem ()
{
  // Workaround for directory entries in entryList
  while (entryList[i].slice(-1) == '/') {
    i++;
    if (i >= entryList.length) { return currTest.end() }
  }
  readEntry(tarball, entryList[i], {}, function (err, buf) {
    if (err) {
      currTest.fail(err.message)
      return currTest.end()
    }

    var entryPath = path.resolve(
      __dirname, "fixtures", "tarball_base", entryList[i])

    fs.readFile(entryPath, function (rfErr, rfBuf) {
      if (rfErr) {
        currTest.fail(rfErr.message)
        return currTest.end()
      }
      // "If no encoding is specified, then the raw buffer is returned."
      currTest.ok(buf.equals(rfBuf), entryList[i]+" should match fs copy")
      i++
      if (i >= entryList.length) { return currTest.end() }
      readNextItem()
    })
  })
}

tap.test("Read gzipped tarball entry data to buffer and validate", function (t) {
  tarball = fxs.naturalTgz
  entryList = fxs.naturalEntries
  currTest = t

  // The Kick-off
  readNextItem()
})

tap.test("Read naked tarball entry data to buffer and validate", function (t) {
  i = 0
  tarball = fxs.constructedTar
  entryList = fxs.constructedEntries
  currTest = t

  readNextItem()
})

// NOTE: in the case of an absolute-path entry, it is or isn't listed by
// command-line tar when the pattern is "*/filename" depending on options:
// * wildcards (wildcardsMatchSlash): yes, all "filename" (if dir, then + all under it)
// * wildcards wildcardsMatchSlash=false: only matches entry "/filename"
// * wildcards (wildcardsMatchSlash) recursion=false: only whole matches
//   (e.g. "*/crontab" gets /etc/crontab, but "/etc" gets nothing on same
//   tarball if there's no entry "/etc/")
// * wildcards wildcardsMatchSlash=false recursion=false: only whole matches

function testPatternMatch (myTest, pattern, opts, re_file)
{
  var tarball = fxs.constructedTar
    , entryList = fxs.constructedEntries
  
  readEntry(tarball, pattern, opts, function (tbErr, tbBuf) {
    if (tbErr) {
      myTest.fail(tbErr.message)
      return myTest.end()
    }

    var entryMatch
      , entryPath
    for (var i = 0; i < entryList.length; i++) {
      if (re_file.test(entryList[i])) {
        entryMatch = entryList[i]
        break
      }
    }
    if (!entryMatch) {
      throw new Error("No match for "+re_file+
        " against fixture entries of contructed.tar!");
    }
    entryPath = path.resolve(__dirname, "fixtures", "tarball_base", entryMatch)

    fs.readFile(entryPath, function (fsErr, fsBuf) {
      if (fsErr) { myTest.fail(fsErr.message) }
      else {
        myTest.ok(tbBuf.equals(fsBuf), [
          "Passing '", pattern, "' with opts ", JSON.stringify(opts),
          " to readEntry() should yield same contents as ", entryMatch
        ].join(''))
      }
      myTest.end()
    })
  })
}

// TODO: change the test title to something more to-the-point
tap.test("Restricted wildcard fetch of tarball entry data", function (t) {
  var opts = { wildcards: true, wildcardsMatchSlash: false }
    , globExpr = "*/passwords.txt"
    , RE_NoGlobStar = /^[^\/]*\/passwords.txt/

  testPatternMatch(t, globExpr, opts, RE_NoGlobStar)
})

// TODO: ditto above
tap.test("Globstar wildcard fetch of tarball entry data", function (t) {
  var opts = { wildcards: true }
    , globExpr = "*/passwords.txt"
    , RE_GlobStar = /^.*\/passwords.txt/

  testPatternMatch(t, globExpr, opts, RE_GlobStar)
})

// Show that option "anchored" is ignored, by showing that the pattern
// "passwords.txt" yields the entry "passwords.txt", and not the preceding
// entry "a/b/c/passwords.txt"
tap.test("Show that option 'anchored' is ignored", function (t) {
  var opts = { anchored: false }
    , pattern = "passwords.txt"
    , RE_patt = /^passwords.txt$/

  testPatternMatch(t, pattern, opts, RE_patt)
})

tap.test("Show that option 'ignoreCase' allows a match, regardless of pattern case",
  function (t) {
    var opts = { ignoreCase: true }
      , pattern = "NPM-DEBUG.LOG"
      , RE_patt = /^NPM-DEBUG.LOG$/i

    testPatternMatch(t, pattern, opts, RE_patt)
})

