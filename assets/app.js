"use strict";
(() => {
 const base=new URL("../",document.currentScript.src),endpoint=window.STUDY_ENDPOINT;
 const key="study3b-session-v2",draftKey="study3b-answers-v2";
 const status=document.getElementById("flow-status")||document.getElementById("form-status");
 const setStatus=message=>{if(status)status.textContent=message;const readingError=document.getElementById("reading-error");if(readingError)readingError.textContent=message;};
 const navigate=path=>location.assign(new URL(path,base));
 const fields=Array.from({length:18},(_,i)=>"q"+String(i+1).padStart(2,"0"));
 let identity;
 function loadIdentity(){try{return JSON.parse(localStorage.getItem(key)||"null");}catch{return null;}}
 function saveIdentity(value){localStorage.setItem(key,JSON.stringify(value));identity=value;}
 function freshIdentity(){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return {participant_id:crypto.randomUUID(),access_token:Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("")};}
 async function api(path,data){
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
   try{
     const response=await fetch(endpoint+"/api/v1/"+path,{method:data===undefined?"GET":"POST",mode:"cors",credentials:"omit",cache:"no-store",signal:controller.signal,
       headers:{...(data===undefined?{}:{"Content-Type":"application/json"}),...(identity?.access_token?{Authorization:"Bearer "+identity.access_token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});
     const result=await response.json();if(!response.ok)throw new Error(result.error||"连接失败，请保留页面并重试。");return result;
   }catch(error){if(error.name==="AbortError"||error instanceof TypeError)throw new Error("连接暂时中断，请保留页面并重试。");throw error;}
   finally{clearTimeout(timeout);}
 }
 identity=loadIdentity();
 const pageType=document.body.dataset.page;
 if(pageType==="start" || pageType==="questionnaire-route"){
   if(!identity){navigate("index.html");return;}
   api("session").then(session=>navigate(session.completed?"done.html":pageType==="questionnaire-route"&&session.can_answer?session.questionnaire_path:session.reading_path)).catch(error=>{setStatus(error.message);document.getElementById("return-home").hidden=false;});return;
 }
 const entry=document.getElementById("entry-form");
 if(entry){
   entry.addEventListener("submit",async event=>{
     event.preventDefault();if(!entry.reportValidity())return;
     const button=document.getElementById("start-button");button.disabled=true;setStatus("正在连接，请稍候…");
     try{
       if(!identity)saveIdentity(freshIdentity());
       const session=await api("start",{...identity,consent:true});navigate(session.completed?"done.html":session.reading_path);
     }catch(error){setStatus(error.message);button.disabled=false;}
   });return;
 }
 async function current(){
   if(!identity){navigate("index.html");return null;}
   const session=await api("session");
   if(document.body.dataset.code && document.body.dataset.code!==session.condition_code){navigate(pageType==="questionnaire"?session.questionnaire_path:session.reading_path);return null;}
   if(session.completed && pageType!=="done"){navigate("done.html");return null;}return session;
 }
 if(pageType==="reading"){
   const next=document.getElementById("continue-button"),clock=document.getElementById("reading-clock");
   let accumulated=0,started=false,previous=performance.now(),wasVisible=!document.hidden,chain=Promise.resolve(),ready=false;
   function tick(){const now=performance.now();if(started&&wasVisible)accumulated+=Math.max(0,now-previous);previous=now;wasVisible=!document.hidden;}
   function render(){const seconds=Math.max(0,Math.ceil((30000-accumulated)/1000));clock.textContent=ready?"已完成至少30秒阅读，可以继续作答。":seconds>0?"请至少阅读30秒，约 "+seconds+" 秒后可继续。":"正在确认阅读时间…";}
   function sync(){
     chain=chain.catch(()=>{}).then(async()=>{tick();const result=await api("reading-progress",{visible_ms:Math.floor(accumulated)});
       accumulated=Math.max(result.reading_visible_ms,accumulated);ready=result.reading_visible_ms>=30000;next.disabled=!ready;setStatus("");render();return result;
     }).catch(error=>{ready=false;next.disabled=true;setStatus(error.message);throw error;});return chain;
   }
   document.addEventListener("visibilitychange",()=>{tick();render();if(started)sync().catch(()=>{});});
   next.addEventListener("click",async()=>{
     next.disabled=true;try{await sync();const result=await api("reading-finish",{});started=false;navigate(result.questionnaire_path);}
     catch(error){setStatus(error.message);next.disabled=!ready;}
   });
   (async()=>{
     try{
       let session=await current();if(!session)return;document.body.classList.add("session-ready");
       await Promise.all(Array.from(document.images).map(img=>img.complete?(img.naturalWidth?Promise.resolve():Promise.reject(new Error("图片未能加载，请刷新后继续。"))):new Promise((resolve,reject)=>{img.addEventListener("load",resolve,{once:true});img.addEventListener("error",()=>reject(new Error("图片未能加载，请刷新后继续。")),{once:true});})));
       session=await api("reading-start",{});accumulated=session.reading_visible_ms;ready=session.can_answer;next.disabled=!ready;previous=performance.now();wasVisible=!document.hidden;started=!session.can_answer;render();
       if(started){setInterval(()=>{tick();render();},250);setInterval(()=>{if(started)sync().catch(()=>{});},2000);}
     }catch(error){setStatus(error.message);document.getElementById("return-home").hidden=false;}
   })();return;
 }
 if(pageType==="questionnaire"){
   const form=document.getElementById("rating-form"),button=document.getElementById("complete-button");let allowed=false;
   form.addEventListener("input",()=>{const draft=Object.fromEntries(new FormData(form));try{sessionStorage.setItem(draftKey,JSON.stringify({token:identity.access_token,answers:draft}));}catch{}});
   form.addEventListener("submit",async event=>{
     event.preventDefault();if(!allowed||!form.reportValidity())return;
     const data=new FormData(form),answers=Object.fromEntries(fields.map(name=>[name,Number(data.get(name))]));
     button.disabled=true;setStatus("正在保存，请勿关闭页面…");
     try{const result=await api("submit",{answers});if(!result.saved)throw new Error("尚未确认保存，请重试。");try{sessionStorage.removeItem(draftKey);}catch{}navigate("done.html");}
     catch(error){setStatus(error.message);button.disabled=false;}
   });
   (async()=>{
     try{const session=await current();if(!session)return;if(!session.can_answer){navigate(session.reading_path);return;}
       allowed=true;for(const fieldset of form.querySelectorAll("fieldset"))fieldset.disabled=false;button.disabled=false;document.body.classList.add("session-ready");
       try{const draft=JSON.parse(sessionStorage.getItem(draftKey)||"null");if(draft?.token===identity.access_token)for(const name of fields){const value=draft.answers[name];const input=form.querySelector(`input[name="${name}"][value="${value}"]`);if(input)input.checked=true;}}catch{}
     }catch(error){setStatus(error.message);document.getElementById("return-home").hidden=false;}
   })();return;
 }
 if(pageType==="done"){
   current().then(session=>{if(!session)return;if(!session.completed){navigate(session.can_answer?session.questionnaire_path:session.reading_path);return;}document.getElementById("completion-content").hidden=false;setStatus("");
   }).catch(error=>{setStatus(error.message);document.getElementById("return-home").hidden=false;});
 }
})();
