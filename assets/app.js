"use strict";
(() => {
 const codes=["k7m2","v4r9","n8q3","t6w5"];
 const start=document.getElementById("start-link");
 if(start){
  start.addEventListener("click",event=>{
   event.preventDefault();
   let code=null;
   try {code=sessionStorage.getItem("reading-code");} catch {}
   if(!codes.includes(code)){
    const values=new Uint32Array(1);
    if(globalThis.crypto?.getRandomValues){crypto.getRandomValues(values);code=codes[values[0]%4];}
    else code=codes[Math.floor(Math.random()*4)];
    try {sessionStorage.setItem("reading-code",code);} catch {}
   }
   location.assign("r/"+code+".html");
  });
 }
 const form=document.getElementById("rating-form");
 if(!form)return;
 form.addEventListener("submit",event=>event.preventDefault());
 document.getElementById("complete-button").addEventListener("click",()=>{
  const status=document.getElementById("form-status");
  if(!form.reportValidity()){status.textContent="请为每道题选择一项。";return;}
  const answers=new FormData(form);
  const valid=Array.from({length:18},(_,i)=>"q"+String(i+1).padStart(2,"0")).every(name=>/^[1-7]$/.test(answers.get(name)||""));
  if(!valid){status.textContent="请为每道题选择1至7中的一项。";return;}
  status.textContent="";document.getElementById("completion").hidden=false;
  document.getElementById("completion").scrollIntoView({block:"nearest"});
 });
})();
