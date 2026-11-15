'use strict';
/* Written with AI assistance: Claude, an AI assistant by Anthropic. See README, section "Use of AI". */
/* Earth Jukebox records: what each NASA visualization shows and how its colours are read.
   A decoder turns one pixel (r,g,b in 0..1) into a data value v (0..1) and a category c,
   or returns false when the pixel carries no data (background, land, labels). */
(function(g){
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function hue(r,g,b,mx,s){let h;if(mx===r)h=((g-b)/s)%6;else if(mx===g)h=(b-r)/s+2;else h=(r-g)/s+4;h*=60;return h<0?h+360:h;}

const DECODE={
 // rainbow temperature scale: blue 0 °C, green about 15 °C, yellow 25 °C, red 32 °C
 temp(r,g,b,o){const mx=Math.max(r,g,b),s=mx-Math.min(r,g,b);if(s<.22||mx<.22)return false;
  let h=hue(r,g,b,mx,s),t;if(h>270)h=0;
  if(h>=180)t=(240-Math.min(h,240))/60*8;else if(h>=120)t=8+(180-h)/60*7;else if(h>=60)t=15+(120-h)/60*10;else t=25+(60-h)/60*7;
  o.v=clamp(t/32,0,1);o.c=0;return true;},
 // particle types by colour: 0 smoke (orange, red), 1 sulfate (green), 2 sea salt (blue, white), 3 dust (pink)
 aerosol(r,g,b,o){const mx=Math.max(r,g,b),s=mx-Math.min(r,g,b);if(mx<.2)return false;
  if(s<.11){if(mx>.62&&b>=r){o.v=mx;o.c=2;return true;}return false;}
  if(r>=g&&r>=b)o.c=(b>g*1.1&&b>r*.5)?3:0;else if(g>=b)o.c=1;else o.c=(r>g*1.15&&r>b*.5)?3:2;
  o.v=clamp(mx*1.05,0,1);return true;},
 // yellow dots on a dark globe
 dots(r,g,b,o){if(r>.55&&g>.45&&b<g*.62){o.v=1;o.c=0;return true;}return false;},
 // anything bright on a dark background
 glow(r,g,b,o){const l=.2126*r+.7152*g+.0722*b;if(l<.08)return false;o.v=clamp(l*2.2,0,1);o.c=0;return true;},
 // stronger colour means more
 tint(r,g,b,o){const mx=Math.max(r,g,b),s=mx-Math.min(r,g,b);if(s<.12||mx<.2)return false;o.v=clamp(s*1.4,0,1);o.c=0;return true;},
 // blue shading only
 vapor(r,g,b,o){const mx=Math.max(r,g,b),s=mx-Math.min(r,g,b);if(s<.15||b<r*1.15||b<g*.8)return false;o.v=clamp(s*1.7,0,1);o.c=0;return true;},
 // green land on blue sea; brighter green is taller forest
 canopy(r,g,b,o){if(b>g*1.02||g<.15)return false;const l=.2126*r+.7152*g+.0722*b;o.v=clamp((l-.15)/.55,0,1);o.c=0;return true;},
 // any picture: brightness as value, colour family as category
 any(r,g,b,o){const mx=Math.max(r,g,b),s=mx-Math.min(r,g,b),l=.2126*r+.7152*g+.0722*b;if(l<.07)return false;o.v=clamp(l*1.2,0,1);
  if(s<.12){o.c=5;return true;}const h=hue(r,g,b,mx,s);o.c=h<20||h>=340?0:h<70?1:h<165?2:h<265?3:4;return true;}
};

/* rough place names for flat world maps (plate carrée, 180°W on the left edge) */
function ocean(lat,lon){
 if(lat>66)return 'Arctic Ocean';if(lat<-60)return 'Southern Ocean';
 if(lon>=-6&&lon<37&&lat>30&&lat<46)return 'Mediterranean Sea';
 if(lon>=-98&&lon<-60&&lat>8&&lat<31)return 'Caribbean Sea and Gulf of Mexico';
 if(lon>=20&&lon<120&&lat<28)return 'Indian Ocean';
 if(lon>=120&&lon<147&&lat<-10&&lat>-60&&lon<130)return 'Indian Ocean';
 if(lon>=-70&&lon<20)return (lat>=0?'North':'South')+' Atlantic';
 return (lat>=0?'North':'South')+' Pacific';
}
const LAND=[['North America',15,72,-168,-52],['South America',-56,12,-82,-34],['Europe',36,71,-10,40],['Africa',-35,36,-18,52],['Asia',5,77,40,180],['Australia',-45,-10,112,155]];
function near(lat,lon){if(lat<-62)return 'Antarctica';for(const b of LAND)if(lat>=b[1]&&lat<=b[2]&&lon>=b[3]&&lon<=b[4])return 'around '+b[0];return ocean(lat,lon);}
function coords(lat,lon){const a=Math.round(Math.abs(lat)),o=Math.round(Math.abs(lon));return (a?a+'°'+(lat>=0?'N':'S'):'equator')+', '+o+'°'+(lon>=0?'E':'W');}
function place(kind,u,v){const lat=90-v*180,lon=-180+u*360;return (kind==='ocean'?ocean(lat,lon):near(lat,lon))+' ('+coords(lat,lon)+')';}

const amountWord=r=>r<.04?'almost no':r<.25?'a little':r<.6?'some':'a lot of';
const thirds=['Top','Middle','Bottom'];
const ROWS={names:thirds,rects:[[[0,0,1,1/3]],[[0,1/3,1,2/3]],[[0,2/3,1,1]]]};
const GLOBE={names:['North','Tropics','South'],rects:ROWS.rects};
// north of 23.5°N, the tropics, south of 23.5°S on a flat world map
const LATS={names:['North','Tropics','South'],rects:[[[0,0,1,.369]],[[0,.369,1,.631]],[[0,.631,1,1]]]};
const amt=(thing)=>(v=>(v<.33?'A little ':v<.66?'Some ':'A lot of ')+thing);
const AMOUNT_KEY=[{label:'A little',v:.15},{label:'Some',v:.5},{label:'A lot',v:.95}];

const RECORDS=[
 {code:'A1',id:'currents',title:'Sea surface temperature and currents',sub:'World map, ocean model',svs:3912,file:'media/currents.mp4',
  decode:'temp',mode:'value',zones:LATS,geo:'ocean',cats:[{name:'water',wave:'triangle'}],nodata:'Land or no data',
  label:v=>{const t=Math.round(v*32);return (t<5?'Very cold':t<13?'Cold':t<20?'Mild':t<27?'Warm':'Hot')+' water, about '+t+' °C';},
  zoneLabel:v=>Math.round(v*32)+' °C',
  shows:'A flat world map of the ocean surface from the ECCO2 ocean model. Thousands of thin lines trace the currents, and their colour is the temperature of the water.',
  colors:'Blue is water near 0 °C, green is around 15 °C, yellow around 25 °C and red is up to 32 °C. Land is grey.',
  how:'Higher note means warmer water. Point at any sea to hear its temperature and read its name. Press Play and three notes take turns: the north, the tropics and the south.',
  key:[{label:'Very cold, 2 °C',v:2/32},{label:'Mild, 16 °C',v:.5},{label:'Warm, 24 °C',v:.75},{label:'Hot, 31 °C',v:31/32}]},
 {code:'A2',id:'aerosols',title:'Aerosols in the air',sub:'World map, 19 August 2025',svs:5669,file:'media/aerosols.jpg',image:true,
  decode:'aerosol',mode:'cat',zones:LATS,geo:'near',nodata:'Clear air or no data',
  cats:[{name:'Smoke',wave:'sawtooth'},{name:'Sulfate',wave:'square'},{name:'Sea salt',wave:'sine'},{name:'Dust',wave:'triangle'}],
  label:function(v,c){return this.cats[c].name+', '+(v<.5?'thin':v<.78?'moderate':'thick');},
  shows:'One moment from NASA’s GEOS model: the tiny particles floating in the air over the whole world on 19 August 2025.',
  colors:'Orange and red are smoke from fires. Green is sulfate from pollution and volcanoes. Pink is desert dust. Blue and white swirls are sea salt whipped up by wind.',
  how:'Each kind of particle has its own instrument: smoke buzzes, sulfate is hollow, sea salt is a pure tone and dust is soft. Higher means thicker. Point anywhere to hear and read what is in the air there.',
  key:[{label:'Smoke',v:.7,c:0},{label:'Sulfate',v:.7,c:1},{label:'Sea salt',v:.7,c:2},{label:'Dust',v:.7,c:3}]},
 {code:'A3',id:'lightning',title:'Lightning seen from the Space Station',sub:'Globe, 2017 to 2023',svs:5011,file:'media/lightning.mp4',
  decode:'dots',mode:'amount',style:'ticks',thing:'lightning',zones:GLOBE,cats:[{name:'lightning',wave:'triangle'}],nodata:'No lightning here right now',
  label:()=>'Lightning',
  shows:'A turning globe with every lightning flash recorded by the Lightning Imaging Sensor on the International Space Station from 2017 to 2023. Each moment shows the flashes of the last ten days.',
  colors:'Every yellow dot is lightning. The rest of the globe is dark.',
  how:'Lightning is played as ticks, like a Geiger counter: more ticks mean more lightning. High ticks are the north, middle ticks the tropics and low ticks the south. Listen for the storms moving north and south with the seasons.',
  key:[{label:'A little lightning',v:.3},{label:'A lot of lightning',v:1}]},
 {code:'A4',id:'airquality',title:'Wildfire smoke and air quality',sub:'Eight panels, summer 2024',svs:5533,file:'media/airquality.mp4',
  decode:'tint',mode:'amount',thing:'pollution',cats:[{name:'pollution',wave:'triangle'}],nodata:'No data here',
  zones:{names:['Yellow panels','Green panels','Purple panels','Orange panels'],rects:[0,1,2,3].map(i=>[[i/8,0,(i+1)/8,1],[(i+4)/8,0,(i+5)/8,1]])},
  label:amt('pollution'),
  shows:'Eight panels side by side from NASA’s air quality model during the fire season of July and August 2024. They follow four pollutants: carbon monoxide, fine particles, ozone and nitrogen oxides.',
  colors:'Each pollutant has its own colour: yellow, green, purple and orange. Inside a panel, a stronger colour means more of that pollutant.',
  how:'Higher and louder means more pollution. Press Play and the four colours take turns, so you can hear which pollutant is building up.',
  key:AMOUNT_KEY},
 {code:'B1',id:'river',title:'A river in the sky',sub:'Atmospheric river in 3D',svs:4960,file:'media/river.mp4',
  decode:'vapor',mode:'amount',thing:'moving moisture',zones:ROWS,cats:[{name:'moisture',wave:'sine'}],nodata:'Little moisture here',
  label:amt('moving moisture'),
  shows:'A three-dimensional view over the Pacific of an atmospheric river: a long, narrow band of moist air that carries water from the tropics toward the coast. From NASA’s MERRA-2 record.',
  colors:'Blue shading shows how much water vapour the air is moving. Stronger blue means more.',
  how:'Higher and louder means more moisture on the move. Point along the band to follow the river across the ocean.',
  key:AMOUNT_KEY},
 {code:'B2',id:'gedi',title:'How tall the forest is',sub:'Laser measurements over Florida',svs:4950,file:'media/gedi.mp4',
  decode:'canopy',mode:'value',zones:ROWS,cats:[{name:'forest',wave:'triangle'}],nodata:'Water',
  label:v=>v<.33?'Low plants':v<.66?'Medium-height forest':'Tall forest',
  shows:'Florida seen from above, with forest heights measured by GEDI, a laser instrument on the International Space Station. The heights are stretched upward so they are easy to see.',
  colors:'Blue is the sea. On land, brown and dark green are low plants, bright green and white are tall trees.',
  how:'Higher note means taller plants. Point at the land to hear how tall the forest is there.',
  key:[{label:'Low plants',v:.15},{label:'Medium forest',v:.5},{label:'Tall forest',v:.9}]},
 {code:'B3',id:'co2',title:'Carbon dioxide around the globe',sub:'Globe, January to March 2020',svs:5196,file:'media/co2.mp4',
  decode:'glow',mode:'amount',thing:'bright haze',zones:GLOBE,cats:[{name:'haze',wave:'triangle'}],nodata:'Dark, nothing here',
  label:amt('bright haze'),
  shows:'A model of carbon dioxide in the atmosphere from January to March 2020, shown on a slowly turning globe. Plumes rise from sources on the ground and are carried along by the wind.',
  colors:'The glowing haze over the globe is carbon dioxide. Brighter means a higher concentration. The lit surface of the globe also counts as bright here, so read this one with care.',
  how:'Higher and louder means a brighter picture in that part of the globe.',
  key:AMOUNT_KEY},
 {code:'B4',id:'nightlights',title:'Night lights, 2012 to 2023',sub:'Wide wall of world maps',svs:5313,file:'media/nightlights.mp4',
  decode:'glow',mode:'amount',thing:'light',zones:{names:['Left','Centre','Right'],rects:[[[0,0,1/3,1]],[[1/3,0,2/3,1]],[[2/3,0,1,1]]]},cats:[{name:'light',wave:'sine'}],nodata:'Dark',
  label:amt('light'),
  shows:'A very wide picture made for a video wall: world maps of Earth at night from 2012 to 2023, then a map of where the lights changed, then close views of India, Ukraine, Western Europe and the Eastern Mediterranean.',
  colors:'Light dots are cities. On the change map, purple marks places that became brighter and orange marks places that became dimmer.',
  how:'Higher and louder means more light. The lights are small, so point slowly.',
  key:AMOUNT_KEY}
];
const GENERIC={id:'own',title:'Your own picture',decode:'any',mode:'amount',thing:'brightness',zones:ROWS,nodata:'Dark, nothing here',
 cats:[{name:'red',wave:'sawtooth'},{name:'orange or yellow',wave:'triangle'},{name:'green',wave:'square'},{name:'blue',wave:'sine'},{name:'purple or pink',wave:'triangle'},{name:'white or grey',wave:'sine'}],
 label:function(v,c){return (v<.33?'Dark ':v<.66?'Medium ':'Bright ')+this.cats[c].name;},
 shows:'A picture or video that Earth Jukebox has no description for.',colors:'',
 how:'Higher and louder means brighter. Each colour family has its own tone. Point anywhere to hear and read the colour and brightness there.',
 key:AMOUNT_KEY};

g.EJ_RECORDS=RECORDS;g.EJ_GENERIC=GENERIC;g.EJ_DECODE=DECODE;g.EJ_UTIL={amountWord,place,clamp};
})(globalThis);
