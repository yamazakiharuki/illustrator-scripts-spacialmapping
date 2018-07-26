// yamac-spatial-mapping-like.jsx
//
// Microsoft HoloLensのSpatial Mapping風ビジュアルを
// ドロネー三角形分割を利用して作成します。
//
// Copyright 2018 *Haruki Yamazaki
// This script is distributed under the MIT License.
//
// *
// このスクリプトはHiroyuki Satoさん作のスクリプトを元にしています。
// http://github.com/shspage
// Licensed under The MIT License
// *
// ironwallabyさん作の'delaunay.js'をincludeする必要があります。
// 以下よりダウンロードし、このスクリプトと同じディレクトリに格納してください。
// https://github.com/ironwallaby/delaunay
// Licensed under CC0 1.0 Universal (CC0 1.0)
//
// 2018.07.27


//@include "delaunay.js"

var ver10 = (version.indexOf('10') == 0);

main();
function main(){
//
// パスの分割
//
  var paths = [];
  getPathItemsInSelection(n, paths);
  if(paths.length < 1) return;

  var n = 6;
  if(! ver10) {
    n = prompt("パスの分割数を入力してください（2以上）", n);
    if(! n) {
      return;
    } else if(isNaN(n) || n < 2){
      alert("2以上の値を入力してください");
      return;
    }
    n = parseInt(n);
  }

  var i, j, k, p, q;
  var pnts, len, ar, redrawflg;

  for(var h = 0; h < paths.length; h++) {
    redrawflg = false;
    pnts = [];
    p = paths[h].pathPoints;

    for(i = 0; i < p.length; i++) {
      j = parseIdx(p, i + 1);
      if(j < 0) break;
      if(! sideSelection(p[i], p[j])) continue;
      ar = [i];
      q = [p[i].anchor, p[i].rightDirection,
      p[j].leftDirection, p[j].anchor];
      len = getT4Len(q, 0) / n;
      if(len <= 0) continue;
      redrawflg = true;

      for(k = 1; k < n; k++) {
        ar.push( getT4Len(q, len * k) );
      }
      pnts.push(ar);
    }
    if(redrawflg) addPnts(paths[h], pnts, false);
  }
  activeDocument.selection = paths;

//
// ドロネー三角形分割用の点を生成（アンカーポイントにオブジェクトを複製）
//
  if(documents.length < 1) return;

  var s = activeDocument.selection;
  if(!(s instanceof Array) || s.length < 2) return;

  var tgt_item = s[0]; // アンカーポイントに複製する元図形
  var tgt_point = [];

  // 選択されているアンカーポイントが1個かどうかの確認
  if(tgt_item.typename == "PathItem"){
    var p = tgt_item.pathPoints;

    for(i = 0; i < p.length; i++){
      if(isSelected(p[i])){
        if(tgt_point.length < 1){
          tgt_point = p[i].anchor;
        }
        else { //２つ以上のアンカーポイントが選択されている
          tgt_point = [];
          break;
        }
      }
    }
  }

  if(tgt_point.length < 1){ //２つ以上のアンカーポイントが選択されている
    var vb = tgt_item.visibleBounds; // left, top, right, bottom
    tgt_point = [(vb[0] + vb[2]) / 2, (vb[1] + vb[3]) / 2];
  }

  var paths = [];
  extractPaths(s.slice(1), 0, paths);

  for(i = 0; i < paths.length; i++){
    p = paths[i].pathPoints;

    for(var j = 0; j < p.length; j++){
      if(isSelected(p[j])){
        tgt_item.duplicate().translate(p[j].anchor[0] - tgt_point[0], p[j].anchor[1] - tgt_point[1]);
      }
    }
  }

//
// SpaticialMap風処理（ドロネー三角形分割）
//
  if(isBadCondition()) return;
  var adoc = app.activeDocument;
  var paths = [];
  var sel = adoc.selection;
  if(sel.length > 0) {
    // あとで選択物の背面に描画するため、選択物中の最背面の物を取得。
    var backmost = getBackmostObject(sel);
    getSelectedPaths(sel, paths);
  }
  if(paths.length < 3) {
    alert("３つ以上のパスを選択してください。");
    return;
  }

  var vertices = [];
  for(i = 0, iEnd = paths.length; i < iEnd; i++) {
    vertices.push(getCenter(paths[i]));
  }

  // 戻り値は vertices の index の配列です。
  // ３つずつ順に取り出して三角形の頂点として使います。
  var idxs = Delaunay.triangulate(vertices);
  // アートボードへの描画
  // 描画した三角形はグループ化されています。
  var gr = adoc.activeLayer.groupItems.add();
  gr.move(backmost, ElementPlacement.PLACEAFTER);
  var p = createAPath();
  p.move(gr, ElementPlacement.PLACEATEND);

  for(i = 0, iEnd = idxs.length; i < iEnd; i+=3) {
    var triangle = p.duplicate();
    // SpaticialMap風にする場合、塗り色の指定は不要
    //triangle.fillColor = getFillColor();
    triangle.setEntirePath([vertices[idxs[i]], vertices[idxs[i + 1]], vertices[idxs[i + 2]]]);
  }
  p.remove();
}


//
// 対象となるオブジェクトのパスを
// 分割する（アンカーポイントを増やす）関数群です。
//

function addPnts(pi, pnts, need2sort) {
  var p = pi.pathPoints;
  var pnts2 = [];
  var adjNextLDir  = 0;
  var adjFirstLDir = 0;
  var idx = (pi.closed && pnts[pnts.length-1][0] == p.length - 1) ? 0 : pnts[0][0];
  var ar = pnts.shift();
  var nidx = ar.shift();
  var j, pnt, q;
  for(var i = idx; i < p.length; i++) {
    pnts2.push( getDat(p[i]) );
    if(adjNextLDir > 0) {
      pnts2[pnts2.length-1][2] = adjHanP(p[i],0,1-adjNextLDir);
    }
    if(nidx == i) {
      if(ar.length > 0) {
        if(need2sort){
          ar.sort();
          ar = getUniq(ar);
        }
        if(i == p.length - 1 && idx == 0) {
          adjFirstLDir = ar[ar.length-1];
        }
        pnts2[pnts2.length - 1][1] = adjHanP(p[i], 1, ar[0]),
        ar.unshift(0);
        ar.push(1);
        nxi = parseIdx(p,i + 1);
        if(nxi < 0) break;
        q = [p[i].anchor, p[i].rightDirection,
             p[nxi].leftDirection, p[nxi].anchor];
        if(arrEq(q[0], q[1]) && arrEq(q[2], q[3])) {
          for(j = 1; j < ar.length - 1; j++) {
            pnt = bezier(q, ar[j]);
            pnts2.push( [pnt, pnt, pnt, PointType.CORNER] );
          }
        } else {
          for(j = 1; j < ar.length - 1; j++) {
            pnts2.push( getDivPnt(q, ar[j-1], ar[j], ar[j+1]) );
          }
        }
         adjNextLDir = ar[ar.length - 2];
      } else {
        adjNextLDir = 0;
      }
      if(pnts.length > 0) {
        ar = pnts.shift();
        nidx = ar.shift();
      }
    } else {
      adjNextLDir = 0;
    }
  }
  if(adjFirstLDir > 0) pnts2[0][2] = adjHanP(p[0], 0, 1 - adjFirstLDir);
  if(pnts2.length > 0) applyData2AfterIdx(p, pnts2, idx - 1);
}

function getUniq(ar) {
  if(ar.length < 2) return ar;
  var ar2 = [ ar[0] ];
  var torelance = 0.01;
  for(var i = 1; i < ar.length; i++){
    if(ar[i] - ar2[ ar2.length - 1 ] > torelance) ar2[ar2.length] = ar[i];
  }
  return ar2;
}

function getDat(p) {
  with(p) return [anchor, rightDirection, leftDirection, pointType];
}

function adjHanP(p, n, m) {
  with(p) {
    var d = (n == 1 ? rightDirection : leftDirection);
    return [anchor[0] + (d[0] - anchor[0]) * m,
            anchor[1] + (d[1] - anchor[1]) * m];
  }
}

function getDivPnt(q, t0, t1, t2, anc) {
  if(!anc) anc = bezier(q, t1);
  var r = defDir(q,1, t1, anc, (t2 - t1) / (1 - t1));
  var l = defDir(q,0, t1, anc, (t1 - t0) / t1);
  return [ anc, r, l, PointType.SMOOTH ];
}

function defDir(q, n, t, anc, m) {
  var dir = [ t * (t * (q[n][0] - 2 * q[n+1][0] + q[n+2][0]) + 2 * (q[n+1][0] - q[n][0])) + q[n][0],
              t * (t * (q[n][1] - 2 * q[n+1][1] + q[n+2][1]) + 2 * (q[n+1][1] - q[n][1])) + q[n][1]];
  return [anc[0] + (dir[0] - anc[0]) * m,
          anc[1] + (dir[1] - anc[1]) * m];
}

function bezier(q, t) {
  var u = 1 - t;
  return [u*u*u * q[0][0] + 3*u*t*(u* q[1][0] + t* q[2][0]) + t*t*t * q[3][0],
          u*u*u * q[0][1] + 3*u*t*(u* q[1][1] + t* q[2][1]) + t*t*t * q[3][1]];
}

function applyData2Path(p, pnts) {
  if(pnts.length<1) return;

  var pt;

  while(p.length > pnts.length) {
    p[ p.length - 1 ].remove();
  }

  for(var i in pnts) {
    pt = i < p.length ? p[i] : p.add();
    with(pt){
      anchor         = pnts[i][0];
      rightDirection = pnts[i][1];
      leftDirection  = pnts[i][2];
      pointType      = pnts[i][3];
    }
  }
}

function applyData2AfterIdx(p, pnts, idx) {
  if(idx == null || idx < 0) {
    applyData2Path(p, pnts);
    return;
  }
  var pt;

  while(p.length-1 > idx) {
    p[p.length-1].remove();
  }

  for(var i = 0; i < pnts.length; i++) {
    pt = p.add();
    with(pt){
      anchor         = pnts[i][0];
      rightDirection = pnts[i][1];
      leftDirection  = pnts[i][2];
      pointType      = pnts[i][3];
    }
  }
}

function sideSelection(ps1, ps2) {
  return (ps1.selected != PathPointSelection.NOSELECTION
      && ps1.selected != PathPointSelection.LEFTDIRECTION
      && ps2.selected != PathPointSelection.NOSELECTION
      && ps2.selected != PathPointSelection.RIGHTDIRECTION);
}

function arrEq(arr1, arr2) {
  for(var i in arr1){
    if (arr1[i] != arr2[i]){
      return false;
    }
  }
  return true;
}

function getT4Len(q, len) {
  var m = [q[3][0] - q[0][0] + 3 * (q[1][0] - q[2][0]),
           q[0][0] - 2 * q[1][0] + q[2][0],
           q[1][0] - q[0][0]];
  var n = [q[3][1] - q[0][1] + 3 * (q[1][1] - q[2][1]),
           q[0][1] - 2 * q[1][1] + q[2][1],
           q[1][1] - q[0][1]];
  var k = [ m[0] * m[0] + n[0] * n[0],
            4 * (m[0] * m[1] + n[0] * n[1]),
            2 * ((m[0] * m[2] + n[0] * n[2]) + 2 * (m[1] * m[1] + n[1] * n[1])),
            4 * (m[1] * m[2] + n[1] * n[2]),
            m[2] * m[2] + n[2] * n[2]];

   var fullLen = getLength(k, 1);

  if(len == 0) {
    return fullLen;

  } else if(len < 0) {
    len += fullLen;
    if(len < 0) return 0;

  } else if(len > fullLen) {
    return 1;
  }

  var t, d;
  var t0 = 0;
  var t1 = 1;
  var torelance = 0.001;

  for(var h = 1; h < 30; h++) {
    t = t0 + (t1 - t0) / 2;
    d = len - getLength(k, t);

    if(Math.abs(d) < torelance) break;
    else if(d < 0) t1 = t;
    else t0 = t;
  }

  return t;
}

function getLength(k, t) {
  var h = t / 128;
  var hh = h * 2;

  var fc = function(t, k) {
    return Math.sqrt(t * (t * (t * (t * k[0] + k[1]) + k[2]) + k[3]) + k[4]) || 0 };

  var total = (fc(0, k) - fc(t, k)) / 2;

  for(var i = h; i < t; i += hh){
    total += 2 * fc(i, k) + fc(i + h, k);
  }

  return total * hh;
}

function getPathItemsInSelection(n, paths) {
  if(documents.length < 1) return;

  var s = activeDocument.selection;

  if (!(s instanceof Array) || s.length < 1) return;

  extractPaths(s, n, paths);
}

function extractPaths(s, pp_length_limit, paths) {
  for(var i = 0; i < s.length; i++) {
    if(s[i].typename == "PathItem") {
      if(pp_length_limit
         && s[i].pathPoints.length <= pp_length_limit){
        continue;
      }
      paths.push(s[i]);

    } else if(s[i].typename == "GroupItem") {
      extractPaths(s[i].pageItems, pp_length_limit, paths);

    } else if(s[i].typename == "CompoundPathItem") {
      extractPaths(s[i].pathItems, pp_length_limit , paths);
    }
  }
}

function parseIdx(p, n) {
  var len = p.length;
  if(p.parent.closed){
    return n >= 0 ? n % len : len - Math.abs(n % len);
  } else {
    return (n < 0 || n > len-1) ? -1 : n;
  }
}


//
// 対象となるオブジェクトのアンカーポイントに
// 任意のオブジェクトを複製配置するための関数群です。
//

function isSelected(p){
  return p.selected == PathPointSelection.ANCHORPOINT;
}

function extractPaths(s, pp_length_limit, paths){
  for(var i = 0; i < s.length; i++){
    if(s[i].typename == "PathItem"
       && ! s[i].guides
       && ! s[i].clipping){

      if(pp_length_limit > 0
         && s[i].pathPoints.length <= pp_length_limit) continue;
      paths.push( s[i] );

    } else if(s[i].typename == "GroupItem"){
      extractPaths( s[i].pageItems, pp_length_limit, paths);

    } else if(s[i].typename == "CompoundPathItem"){
      extractPaths( s[i].pathItems, pp_length_limit, paths);
    }
  }
}


//
// ドロネー三角形分割関連の関数群です。
//
//

function getCenter(p) {
  var gb = p.geometricBounds;  // left, top, right, bottom
  return [(gb[0] + gb[2]) / 2, (gb[1] + gb[3]) / 2 ];
}

function createAPath() {
  var p = app.activeDocument.activeLayer.pathItems.add();
  p.closed = true;
  p.filled = false;　//SpatialMap風の場合はfalseで。
  p.stroked = true;
  //p.fillColor = getFillColor(); //SpatialMap風の場合、塗りの必要なし
  return p;
}

function isBadCondition() {
  if(app.documents.length < 1) {
    return true;
  }
  var adoc = app.activeDocument;
  if(adoc.activeLayer.locked) {
    alert("アクティブレイヤーのロックを解除してください。");
    return true;
  }
  return false;
}

function getSelectedPaths(sel, paths) {
  for(var i = 0, iEnd = sel.length; i < iEnd; i++) {
    if(sel[i].typename == "PathItem") {
      paths.push(sel[i]);
    } else if(sel[i].typename == "GroupItem") {
      getSelectedPaths(sel[i].pageItems, paths);
    } else if(sel[i].typename == "CompoundPathItem") {
      getSelectedPaths(sel[i].pathItems, paths);
    }
  }
}

function getBackmostObject(sel) {
  return sel[sel.length - 1];
}
