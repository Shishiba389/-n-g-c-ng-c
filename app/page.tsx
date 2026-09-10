'use client';

import { foods, type Food } from '@/lib/foods';
import { chestCatalog } from '@/lib/chest-catalog';
import { CaseAudio } from '@/lib/case-audio';
import { createSpinProfile, spinProgress, stopFraction } from '@/lib/case-mechanics';
import { readBrowserCookie, writeBrowserCookie } from '@/lib/browser-cookie';
import { useLocalSpinCount } from '@/hooks/use-local-spin-count';
import { useGlobalSpinCount } from '@/hooks/use-global-spin-count';
import { ArrowLeft, ArrowUpRight, LocateFixed, MapPin, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const colors = ['#5876c9', '#9370c8', '#e5484d', '#c97a52', '#e8b54a'];
const districts = ['Quận 1, TP. Hồ Chí Minh', 'Quận 3, TP. Hồ Chí Minh', 'Quận 5, TP. Hồ Chí Minh', 'Quận 7, TP. Hồ Chí Minh', 'Quận 10, TP. Hồ Chí Minh', 'Bình Thạnh, TP. Hồ Chí Minh', 'Gò Vấp, TP. Hồ Chí Minh', 'Phú Nhuận, TP. Hồ Chí Minh', 'Tân Bình, TP. Hồ Chí Minh', 'TP. Thủ Đức, TP. Hồ Chí Minh'];
const labels = {
  vi: { language:'English', localPrefix:'Tổng lượt đã mở', localSuffix:'hòm', soundOn:'Tắt âm thanh', soundOff:'Bật âm thanh' },
  en: { language:'Tiếng Việt', localPrefix:'Total opened', localSuffix:'cases', soundOn:'Mute sound', soundOff:'Enable sound' },
} as const;
type Chest = { id:number; name:string; kicker:string; description:string; accent:string; ids:number[] };
const chests:Chest[] = [
  {id:1,name:'Hòm Cơm Việt',kicker:'CƠM • XÔI • CƠM PHẦN',description:'50 món cơm Việt — no bụng, đúng gu.',accent:'#f4bd43',ids:[0,9,16,17,36,39,44,45,46,47,56,57,59,64,65,66,90,91,92,93,100,104,117,125,126]},
  {id:2,name:'Hòm Món Nước',kicker:'PHỞ • BÚN • MÌ',description:'50 món nước nóng hổi từ khắp Việt Nam.',accent:'#a78bfa',ids:[1,3,10,11,12,13,19,20,21,23,25,30,31,42,48,50,58,70,71,72,74,75,76,77,79,80,81,82,83,87,88,89,94,95,96,101,102,121,127,128,131]},
  {id:3,name:'Hòm Món Vặt',kicker:'ỐC • XIÊN QUE • ĂN VẶT',description:'50 món vặt phổ biến tại những con hẻm Sài Gòn.',accent:'#e7aa47',ids:[2,34,84,106,107,108,109,110,111,122,124]},
  {id:5,name:'Hòm Món Chay',kicker:'THANH ĐẠM • THỰC VẬT',description:'50 món chay đầy màu sắc và năng lượng.',accent:'#83b99d',ids:[7,32,33,35,61,78,119]},
  {id:6,name:'Hòm Đồ Uống',kicker:'SÀI GÒN • CÀ PHÊ • TRÀ SỮA',description:'50 món nước được giới trẻ TP.HCM yêu thích.',accent:'#70bed1',ids:[4,6,8,24,26,28,29,49,51,52,54,60,62,63,67,68,73,85,86,97,98,99,103,112,113,115,116,120,123,129]}
];

function Art({food}:{food:Food}) {
  const generatedArt=food.customId?.match(/^chest-(\d+):(\d+)$/);
  if(generatedArt){
    const customImage=['1','2'].includes(generatedArt[1])?`${basePath}/food/chest-${generatedArt[1]}/${generatedArt[2]}.webp`:null;
    return <div className={`food-art ${customImage?'food-photo':'food-placeholder'}`} aria-hidden="true" style={customImage?{backgroundImage:`url(${customImage})`}:undefined}/>;
  }
  const n=food.image%132, common=n>=120, lunch=n>=72&&!common, expanded=n>=36&&!lunch;
  const index=common?(n-120)%12:lunch?(n-72)%12:expanded?(n-36)%12:n%4;
  const atlas=common?`food-common-${Math.floor((n-120)/12)}`:lunch?`food-lunch-${Math.floor((n-72)/12)}`:expanded?`food-expanded-${Math.floor((n-36)/12)}`:`food-hd-${Math.floor(n/4)}`;
  return <div className="food-art" aria-hidden="true" style={{backgroundImage:`url(${basePath}/${atlas}.webp)`,backgroundSize:expanded?'400% 300%':'200% 200%',backgroundPosition:expanded?`${index%4/3*100}% ${(common?[0,50,100]:[0,46,92])[Math.floor(index/4)]}%`:`${index%2*100}% ${Math.floor(index/2)*100}%`}}/>;
}
function pool(chest:Chest) {
  const choices=chest.ids.map(id=>foods.find(food=>food.image===id)).filter((food):food is Food=>Boolean(food));
  // Fixed chest odds: 32 blue, 11 purple, 5 pink, 2 gold — exactly 50 picks.
  return chestCatalog[chest.id].map((name,i)=>({...choices[i%choices.length],name,customId:`chest-${chest.id}:${i}`,rarity:i<32?0:i<43?1:i<48?2:4}));
}
export default function Home() {
  const [screen,setScreen]=useState<'home'|'detail'|'spin'|'result'>('home');
  const [selected,setSelected]=useState(chests[0]);
  const [sound,setSound]=useState(true);
  const [language,setLanguage]=useState<'vi'|'en'>('vi');
  const [winner,setWinner]=useState<Food|null>(null);
  const [district,setDistrict]=useState(districts[0]);
  const [location,setLocation]=useState<string|null>(null);
  const [spinReel,setSpinReel]=useState<Food[]>([]);
  const [spinOffset,setSpinOffset]=useState(0);
  const audio=useRef<CaseAudio|null>(null);
  const frame=useRef(0);
  const {count:browserSpins,recordSpin:recordLocalSpin}=useLocalSpinCount();
  const {count:globalSpins,enabled:globalCounterEnabled,recordSpin:recordGlobalSpin}=useGlobalSpinCount();
  const localSpins=globalCounterEnabled?globalSpins:browserSpins;
  const t=labels[language];
  const items=useMemo(()=>pool(selected),[selected]);
  useEffect(()=>{const savedLanguage=readBrowserCookie<'vi'|'en'>('language'),savedSound=readBrowserCookie<boolean>('sound');if(savedLanguage==='vi'||savedLanguage==='en')setLanguage(savedLanguage);if(typeof savedSound==='boolean')setSound(savedSound)},[]);
  useEffect(()=>{document.documentElement.lang=language},[language]);
  useEffect(()=>{try{writeBrowserCookie('sound',sound)}catch{}},[sound]);
  useEffect(()=>{const engine=new CaseAudio(basePath);audio.current=engine;engine.preload();return()=>{engine.dispose();cancelAnimationFrame(frame.current)}},[]);
  useEffect(()=>audio.current?.setMuted(!sound),[sound]);
  useEffect(()=>{
    if(screen!=='spin'||!spinReel.length)return;
    const target=38, tile=232, profile=createSpinProfile(), start=performance.now();
    const end=-(target*tile-window.innerWidth/2+108)-tile*stopFraction();
    let lastCell=Math.floor(-window.innerWidth/2/tile);
    const animate=(now:number)=>{
      const progress=Math.min(1,(now-start)/profile.durationMs);
      const next=end*spinProgress(progress,profile.friction);
      setSpinOffset(next);
      const cell=Math.floor((next-window.innerWidth/2)/tile);
      if(cell!==lastCell){audio.current?.play('csgo_ui_crate_item_scroll');lastCell=cell;}
      if(progress<1){frame.current=requestAnimationFrame(animate);return;}
      if(winner)audio.current?.play((['item_reveal3_rare','item_reveal4_mythical','item_reveal5_legendary','item_reveal6_ancient','item_reveal6_ancient'] as const)[winner.rarity]);
      recordLocalSpin();void recordGlobalSpin();setScreen('result');
    };
    frame.current=requestAnimationFrame(animate);return()=>cancelAnimationFrame(frame.current);
  },[screen,spinReel]);
  const open=()=>{
    // Fixed drop odds are represented directly by the 50-card pool.
    const chosen=items[Math.floor(Math.random()*items.length)];
    const reel:Food[]=[];
    const target=38;
    for(let index=0;index<46;index++){
      const recent=reel.slice(-6);
      const alternatives=items.filter(food=>!recent.includes(food));
      const source=alternatives.length?alternatives:items;
      reel.push(index===target?chosen:source[Math.floor(Math.random()*source.length)]);
    }
    setWinner(chosen);setSpinReel(reel);audio.current?.unlock();audio.current?.play('csgo_ui_crate_open');setSpinOffset(0);setScreen('spin');
  };
  const skip=()=>{cancelAnimationFrame(frame.current);if(winner)audio.current?.play((['item_reveal3_rare','item_reveal4_mythical','item_reveal5_legendary','item_reveal6_ancient','item_reveal6_ancient'] as const)[winner.rarity]);recordLocalSpin();void recordGlobalSpin();setScreen('result')};
  const map=winner?(location
    ?`https://www.google.com/maps/search/${encodeURIComponent(`quán ${winner.name}`)}/@${location},15z`
    :`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`quán ${winner.name}, ${district}`)}`):'#';
  const grabFood=winner?`https://food.grab.com/vn/vi/restaurants?${new URLSearchParams({search:winner.name,'support-deeplink':'true',searchParameter:winner.name})}`:'#';
  const toggleLanguage=()=>{const next=language==='vi'?'en':'vi';setLanguage(next);try{writeBrowserCookie('language',next)}catch{}};
  const LanguageButton=()=> <button className="language-button" type="button" onClick={toggleLanguage}>{t.language}</button>;
  const SoundButton=()=> <><LanguageButton/><button className="icon-button" type="button" aria-label={sound?t.soundOn:t.soundOff} aria-pressed={sound} onClick={()=>setSound(!sound)}>{sound?<Volume2/>:<VolumeX/>}</button></>;
  const District=()=> <select aria-label="Area" value={district} onChange={event=>{setDistrict(event.target.value);setLocation(null)}}>{districts.map(name=><option key={name}>{name}</option>)}</select>;

  if(screen==='home') return <main className="case-app home" id="main-content" style={{'--home-background':`url(${basePath}/cs2-italy-background.webp)`} as React.CSSProperties}><header className="case-header"><a className="wordmark" href={basePath||'/'}>Ăn Gì Cũng Được</a><span>{language==='vi'?'MỞ HÒM • KHÁM PHÁ • TÌM QUÁN':'OPEN • DISCOVER • FIND A PLACE'}</span><SoundButton/></header><section className="popular-head"><div><small>{language==='vi'?'CHỌN BỮA TRƯA TIẾP THEO':'FIND YOUR NEXT BITE'}</small><h1>{language==='vi'?'Chọn một hòm món ăn':'Pick a food chest'}</h1><p>{language==='vi'?'Quay một lượt nhỏ để quyết định món tiếp theo.':'A small spin to help you decide what to eat next.'}</p><p className="local-counter">{t.localPrefix} <strong>{localSpins===null?'—':localSpins.toLocaleString(language==='vi'?'vi-VN':'en-US')}</strong> {t.localSuffix}</p></div></section><section className="chest-grid" aria-label={language==='vi'?'Hòm món ăn':'Food chests'}>{chests.map(chest=><button className="chest-card" key={chest.id} onClick={()=>{setSelected(chest);setScreen('detail')}} style={{'--accent':chest.accent} as React.CSSProperties}><b>{chest.kicker}</b><i>{language==='vi'?'50 LỰA CHỌN':'50 PICKS'}</i><img src={`${basePath}/chest-${chest.id}.png`} alt={`Biểu tượng ${chest.name}`}/><strong>{chest.name}</strong><small>{chest.description}</small></button>)}</section></main>;
  if(screen==='detail') return <main className="case-app detail" id="main-content" style={{'--accent':selected.accent} as React.CSSProperties}><header className="case-header"><button className="back-button" type="button" onClick={()=>setScreen('home')}><ArrowLeft aria-hidden="true" size={19}/>{language==='vi'?'Quay lại':'Back'}</button><span>{language==='vi'?'Hòm món ăn':'Food chests'} / {selected.name}</span><SoundButton/></header><section className="case-hero"><div><small>{selected.kicker}</small><h1>{selected.name}</h1><p>{selected.description}</p><button className="open-case" type="button" onClick={open}><Sparkles aria-hidden="true" size={19}/>{language==='vi'?'Mở hòm':'Open chest'}</button></div><div className="rates"><b>{language==='vi'?'TỶ LỆ NHẬN':'DROP RATES'}</b>{[[language==='vi'?'Xanh · Phổ biến':'Blue · Common','64%',0],[language==='vi'?'Tím · Hiếm':'Purple · Rare','22%',1],[language==='vi'?'Đỏ · Đặc biệt':'Red · Special','10%',2],[language==='vi'?'Vàng · Bí mật':'Gold · Secret','4%',4]].map(([name,rate,rarity])=><div key={name as string}><span style={{color:colors[rarity as number]}}>{name}</span><i><em style={{width:rate as string,background:colors[rarity as number]}}/></i><small>{rate}</small></div>)}</div><img src={`${basePath}/chest-${selected.id}.png`} alt={`Hình ${selected.name}`}/></section><section className="items"><div className="items-title"><div><small>{language==='vi'?'TRONG HÒM CÓ GÌ':'IN THIS CHEST'}</small><h2>{language==='vi'?'50 món có thể nhận':'50 possible picks'}</h2></div><label>{language==='vi'?'Khu vực':'Area'} <District/></label></div><div className="item-grid">{items.map((food,index)=><article key={index} title={food.name} style={{'--rarity':colors[food.rarity]} as React.CSSProperties}>{food.rarity===4&&<span>{language==='vi'?'★ ĐẶC BIỆT':'★ SECRET'}</span>}<Art food={food}/><b>{food.name}</b></article>)}</div></section></main>;
  if(screen==='spin') return <main className="case-app spin" id="main-content"><div className="roulette" aria-label={language==='vi'?'Đang mở hòm':'Opening chest animation'}><div className="spin-line"/><div className="spin-track" style={{transform:`translate3d(${spinOffset}px,0,0)`}}>{spinReel.map((food,index)=><div className="spin-item" key={index} style={{'--rarity':colors[food.rarity]} as React.CSSProperties}><Art food={food}/></div>)}</div></div><div className="spin-controls"><SoundButton/><button type="button" onClick={skip}>{language==='vi'?'Bỏ qua':'Skip'}</button></div></main>;
  return <main className="case-app result" id="main-content" style={{'--accent':selected.accent} as React.CSSProperties}>{winner&&<><small>{language==='vi'?'MÓN CỦA BẠN':'YOUR PICK'}</small><h1>{winner.name}</h1><div className="result-food"><Art food={winner}/></div><div className="result-map"><div><MapPin aria-hidden="true" size={18}/><District/></div><button type="button" aria-pressed={Boolean(location)} onClick={()=>navigator.geolocation?.getCurrentPosition(pos=>setLocation(`${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`),()=>setLocation(null),{enableHighAccuracy:true,timeout:10000,maximumAge:60000})}><LocateFixed aria-hidden="true" size={16}/>{location?(language==='vi'?'Đang dùng vị trí hiện tại':'Using current location'):(language==='vi'?'Dùng vị trí hiện tại':'Use current location')}</button></div><div className="result-actions"><a href={map} target="_blank" rel="noreferrer">{language==='vi'?'TÌM QUÁN':'FIND PLACES'} <ArrowUpRight aria-hidden="true" size={16}/></a><a className="grabfood-button" href={grabFood} target="_blank" rel="noreferrer">GrabFood <ArrowUpRight aria-hidden="true" size={16}/></a><button type="button" onClick={()=>setScreen('detail')}>{language==='vi'?'Khám phá tiếp':'Keep exploring'}</button></div></>}</main>;
}
