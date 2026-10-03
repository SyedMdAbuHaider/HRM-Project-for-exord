import {useCallback,useEffect,useMemo,useState} from 'react';

export type TranslationKey=string;
export type Language='en'|'bn';
const KEY='exord-language';

const dict:Record<Language,Record<string,string>>={en:{},bn:{}};
export function loadUserLang():Language{try{return localStorage.getItem(KEY)==='bn'?'bn':'en'}catch{return'en'}}
export function saveUserLang(lang:Language){try{localStorage.setItem(KEY,lang)}catch{}}
export function getGreetingKey(hour=new Date().getHours()):TranslationKey{return hour<12?'good_morning':hour<18?'good_afternoon':'good_evening'}
export function getGreetingEmoji(hour=new Date().getHours()){return hour<12?'☀️':hour<18?'🌤️':'🌙'}
export function getFirstName(name:string){return name.trim().split(/\s+/)[0]||name}
export function useLanguage(){
 const [lang,setLangState]=useState<Language>(loadUserLang);
 useEffect(()=>{saveUserLang(lang)},[lang]);
 const setLang=useCallback((next:Language)=>setLangState(next),[]);
 const toggleLang=useCallback(()=>setLangState(x=>x==='en'?'bn':'en'),[]);
 const t=useCallback((key:TranslationKey)=>dict[lang][key]||dict.en[key]||key,[lang]);
 return useMemo(()=>({t,lang,setLang,toggleLang}),[t,lang,setLang,toggleLang]);
}
