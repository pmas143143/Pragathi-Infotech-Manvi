const modal = document.getElementById('modal');
let selectedService = '';

function openRequest(service){
  selectedService = service;
  document.getElementById('modalService').textContent = 'Selected service: ' + service;
  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');
}
function closeRequest(){
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden','true');
}
function useSelectedService(){
  closeRequest();
  const select = document.getElementById('service');
  select.value = selectedService;
  document.getElementById('contact').scrollIntoView({behavior:'smooth'});
}
async function sendWhatsApp(e){
  e.preventDefault();
  const service = document.getElementById('service').value;
  const name = document.getElementById('name').value.trim();
  const mobile = document.getElementById('mobile').value.trim();
  const message = document.getElementById('message').value.trim();
  const btn=e.submitter; if(btn){btn.disabled=true; btn.textContent='Sending...';}
  try{
    const r=await fetch('api/enquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({service,name,mobile,message})});
    const data=await r.json();
    if(!r.ok || !data.ok) throw new Error(data.error||'Unable to save enquiry');
    const text = `Hello Pragathi Infotech,\n\nService: ${service}\nName: ${name}\nMobile: ${mobile}\nMessage: ${message || 'Please contact me regarding this service.'}`;
    window.open('https://wa.me/917483311445?text='+encodeURIComponent(text),'_blank','noopener');
    alert('Request saved successfully. WhatsApp is opening now.');
    document.getElementById('requestForm').reset(); closeRequest();
  }catch(err){ alert(err.message || 'Unable to send request. Please call 7483311445.'); }
  finally{ if(btn){btn.disabled=false; btn.textContent='Send Request on WhatsApp';} }
}
async function loadProducts(){
  try{
    const r=await fetch('api/products'); const d=await r.json();
    if(!r.ok||!d.ok||!Array.isArray(d.products)||!d.products.length)return;
    const cards=document.querySelectorAll('#refurbished .product-card');
    d.products.slice(0,3).forEach((x,i)=>{ if(!cards[i])return; const title=cards[i].querySelector('h3'); const desc=cards[i].querySelector('p'); const price=cards[i].querySelector('.price'); const art=cards[i].querySelector('.product-art'); if(title)title.textContent=x.name; if(desc)desc.textContent=x.configuration||'Refurbished computer available'; if(price)price.textContent=x.price||'Contact Us'; if(x.image_data&&art){art.style.backgroundImage=`url('${x.image_data}')`;art.style.backgroundSize='cover';art.style.backgroundPosition='center';art.querySelectorAll('*').forEach(el=>el.style.visibility='hidden');} });
  }catch(e){ /* Static product cards remain available if API is not configured yet. */ }
}
loadProducts();
document.querySelector('.menu').addEventListener('click',()=>{
  document.querySelector('.nav').classList.toggle('mobile');
});
window.addEventListener('click',(e)=>{
  if(e.target === modal) closeRequest();
});
