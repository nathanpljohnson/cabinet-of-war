import math,sys
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter
root=Path(__file__).resolve().parents[1]
S=1024
im=Image.new('RGBA',(S,S),(0,0,0,0))
# rounded plate with walnut gradient
plate=Image.new('RGBA',(S,S),(0,0,0,0));pd=ImageDraw.Draw(plate)
pd.rounded_rectangle((40,40,S-40,S-40),radius=210,fill=(30,22,17,255))
grad=Image.new('RGBA',(S,S));gd=ImageDraw.Draw(grad)
for y in range(S):
    k=y/S;gd.line((0,y,S,y),fill=(int(52-24*k),int(38-18*k),int(28-14*k),255))
mask=plate.split()[3];plate=Image.composite(grad,plate,mask)
im.alpha_composite(plate)
# circular map
x0=14*256//1;z=8
tiles=[(135+i,86+j) for i in range(3) for j in range(3)]
mos=Image.new('RGB',(768,768),(52,74,42))
for i in range(3):
    for j in range(3):
        p=root/f'tiles/{z}/{135+i}/{86+j}.jpg'
        if p.exists():mos.paste(Image.open(p).convert('RGB'),(i*256,j*256))
mos=mos.resize((620,620),Image.LANCZOS)
cm=Image.new('L',(620,620),0);ImageDraw.Draw(cm).ellipse((0,0,619,619),fill=255)
cx=cy=S//2
ring=Image.new('RGBA',(S,S),(0,0,0,0));rd=ImageDraw.Draw(ring)
rd.ellipse((cx-340,cy-340,cx+340,cy+340),fill=(214,178,94,255))
rd.ellipse((cx-326,cy-326,cx+326,cy+326),fill=(30,22,17,255))
im.alpha_composite(ring)
mp=Image.new('RGBA',(620,620));mp.paste(mos,(0,0));mp.putalpha(cm)
im.alpha_composite(mp,(cx-310,cy-310))
# vignette on map
vg=Image.new('RGBA',(S,S),(0,0,0,0));vd=ImageDraw.Draw(vg)
for r in range(310,250,-2):
    a=int(110*(1-(r-250)/60)**2);vd.ellipse((cx-r,cy-r,cx+r,cy+r),outline=(10,6,2,a),width=3)
im.alpha_composite(vg)
# wax seal
seal=Image.new('RGBA',(S,S),(0,0,0,0));sd=ImageDraw.Draw(seal)
pts=[]
for k in range(40):
    a=k/40*2*math.pi;r=165+9*math.sin(k*2.3)
    pts.append((cx+r*math.cos(a),cy+r*math.sin(a)))
sd.polygon(pts,fill=(122,36,26,255))
sd.ellipse((cx-135,cy-135,cx+135,cy+135),fill=(150,44,32,255))
sd.ellipse((cx-135,cy-135,cx+135,cy+135),outline=(90,24,16,255),width=8)
star=[]
for k in range(10):
    r=100 if k%2==0 else 40;a=-math.pi/2+k*math.pi/5
    star.append((cx+r*math.cos(a),cy+r*math.sin(a)))
sd.polygon(star,fill=(224,194,122,255))
sh=seal.filter(ImageFilter.GaussianBlur(14));
shadow=Image.new('RGBA',(S,S),(0,0,0,0));shadow.putalpha(sh.split()[3].point(lambda v:int(v*.5)))
im.alpha_composite(shadow,(0,18))
im.alpha_composite(seal)
im.save('icon_1024.png')
iset=Path('CabinetOfWar.iconset');iset.mkdir(exist_ok=True)
for s in (16,32,128,256,512):
    im.resize((s,s),Image.LANCZOS).save(iset/f'icon_{s}x{s}.png');im.resize((s*2,s*2),Image.LANCZOS).save(iset/f'icon_{s}x{s}@2x.png')
print('icon ok')
