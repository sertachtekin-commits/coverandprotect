(function(){
  var footer = document.querySelector('footer');
  if (!footer || footer.querySelector('.cp-legal-links')) return;
  var wrap = document.createElement('div');
  wrap.className = 'cp-legal-links';
  wrap.style.cssText = 'width:100%;display:flex;gap:14px;justify-content:center;flex-wrap:wrap;font-size:0.78rem;margin-top:12px;';
  var links = [
    ['Privacy Policy','privacy-policy.html'],
    ['Terms','terms-and-conditions.html'],
    ['Insurance Disclaimer','insurance-disclaimer.html'],
    ['Cookie Policy','cookie-policy.html'],
    ['Refund Policy','refund-policy.html'],
    ['FAQ','faq.html'],
    ['Why Choose Us','why-choose-cover-and-protect.html']
  ];
  links.forEach(function(item){
    var a = document.createElement('a');
    a.href = item[1];
    a.textContent = item[0];
    a.style.color = '#e5b657';
    a.style.textDecoration = 'none';
    wrap.appendChild(a);
  });
  footer.appendChild(wrap);
})();
