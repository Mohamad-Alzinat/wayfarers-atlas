"""Original schematic for the existing approximate AtlasRoute world projection.

Run: python make_basemap.py <path-to-world_data.lua> [output.webp]
Dependencies: Pillow and NumPy. Terrain is decorative. Coastlines are constructed
around the graph and checked against its places; they are not game geography.
"""
from pathlib import Path
import math
import random
import re
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import numpy as np

W, H, SCALE = 1000, 800, 2
SIZE = (W * SCALE, H * SCALE)
rng = random.Random(71451)
nrng = np.random.default_rng(71451)


def project(continent, x, y):
    if continent == "ZEP":
        return 495, 80 * 800 / 1060
    if continent == "EK":
        return .1*x + 470, ((9800-y)*.1+60)*800/1060
    return .1*x - 70, ((10000-y)*.1+40)*800/1060


def pairs(string):
    nums = list(map(float, string.split()))
    return list(zip(nums[::2], nums[1::2]))


def scaled(points):
    return [(int(x*SCALE), int(y*SCALE)) for x, y in points]


def coast(points):
    expanded = []
    for (x,y),(a,b) in zip(points, points[1:]+points[:1]):
        dx,dy=a-x,b-y
        length=math.hypot(dx,dy)
        count=max(2,round(length/2.6))
        phase=rng.uniform(0,7)
        for i in range(count):
            t=i/count
            offset=(rng.uniform(-1.8,1.8)+2.8*math.sin(i*.55+phase))*math.sin(math.pi*t)
            expanded.append((x+t*dx-offset*dy/length,y+t*dy+offset*dx/length))
    return expanded


# Gazetteer coordinates govern the extents, narrows, capes and port coves.
# Curves, islands and atmosphere are cartographic interpretation.
outlines = [
    "132 52 114 69 126 72 132 79 111 87 99 78 84 72 62 67 51 50 61 32 79 28 86 17 105 22 111 36",
    "151 145 152 128 177 117 171 105 185 92 183 79 198 80 206 62 232 71 242 52 268 61 265 44 284 60 299 66 322 51 337 60 361 48 389 56 384 70 411 81 419 100 405 116 421 136 399 143 403 161 376 171 391 192 370 203 389 217 373 238 385 265 370 278 388 312 376 325 393 331 405 349 398 374 380 390 374 409 360 414 366 428 354 440 372 452 373 469 400 488 379 494 369 509 385 517 382 528 357 535 350 549 367 572 373 587 386 606 405 614 416 640 435 650 442 666 432 676 443 698 426 721 400 720 377 739 343 734 318 746 306 726 284 730 263 713 240 732 211 716 193 722 173 708 151 719 147 693 129 676 135 650 120 631 136 620 124 599 108 602 103 583 85 579 73 569 77 555 88 547 80 534 95 518 90 498 101 486 88 471 74 471 70 456 78 446 69 429 78 415 68 401 54 396 56 378 79 374 89 356 82 344 99 327 105 297 122 290 118 274 143 266 149 245 164 235 152 209 167 194 158 172",
    "606 113 622 95 639 102 650 79 674 84 696 76 708 91 726 82 742 89 753 70 777 77 796 62 816 69 826 54 850 58 864 41 887 48 886 65 908 66 904 83 927 94 918 108 946 123 951 145 940 156 944 174 929 182 925 197 908 210 903 223 882 216 871 234 851 236 856 252 874 265 862 278 869 294 855 310 846 308 831 330 800 329 784 335 773 329 752 341 771 355 794 346 812 365 840 360 853 383 886 388 879 404 896 420 881 433 893 451 885 463 904 478 895 495 912 516 903 527 920 539 913 551 927 564 906 581 884 581 868 594 872 606 855 612 862 642 850 652 834 665 815 670 817 681 799 689 781 671 764 678 740 663 721 669 706 666 685 681 674 708 659 720 656 739 640 753 641 769 623 774 610 787 591 783 586 775 589 765 582 744 587 732 578 711 590 695 577 683 588 668 564 659 546 639 549 621 533 615 540 590 550 584 546 566 564 555 571 532 592 522 588 509 610 501 625 484 646 486 649 468 666 463 656 449 674 437 662 419 665 400 641 393 633 379 644 365 658 366 650 355 668 351 665 339 684 342 695 331 708 336 717 326 702 316 689 323 677 312 665 311 672 293 660 284 674 268 666 254 646 261 632 250 631 232 616 240 605 225 591 223 589 202 576 199 582 180 577 170 585 156 579 143 593 140",
    "35 549 47 541 56 548 60 557 55 568 45 576 37 565",
    "469 61 474 50 488 48 491 41 506 44 517 54 515 65 505 69 503 74 487 71 480 73",
]
paths=[coast(pairs(p)) for p in outlines]
mask=Image.new("L", SIZE)
md=ImageDraw.Draw(mask)
for p in paths:
    md.polygon(scaled(p), fill=255)

source=Path(sys.argv[1]).read_text(encoding="utf-8")
points={}
for id,c,x,y in re.findall(r'\{ id = "([^"]+)".*?continent = "(\w+)".*?x =\s*(\d+),\s*y =\s*(\d+)',source):
    pos=project(c,int(x),int(y))
    points[id]=pos
    assert mask.getpixel(scaled([pos])[0]), f"{id} lies offshore"
assert len(points)>=70, "World graph input looks incomplete"


def noise(w,h):
    raw=(nrng.random((h,w))*255).astype("uint8")
    field=Image.fromarray(raw).resize(SIZE, Image.Resampling.BICUBIC)
    return (np.asarray(field,dtype="float32")-127)/127


def surface(base, strength):
    stipple=nrng.normal(0,2.6,(SIZE[1],SIZE[0])).astype("float32")
    field=noise(10,8)*8+noise(47,38)*3.5+noise(180,144)*2+stipple
    arr=np.clip(np.asarray(base)[None,None,:]+field[:,:,None]*strength,0,255).astype("uint8")
    return Image.fromarray(arr)


ocean=surface((135,167,153),1.0)
land=surface((218,198,149),1.25)
sea=ImageDraw.Draw(ocean,"RGBA")
for i in range(1300):
    x,y=rng.uniform(0,W),rng.uniform(0,H)
    width=rng.uniform(3,13)
    amp=rng.uniform(.1,1.5)
    sea.line(scaled([(x+t*width/7,y+amp*math.sin(t*.85)) for t in range(8)]),
             fill=(58,94,87,rng.randrange(20,60)),width=rng.choice([1,1,2]))
for p in paths:
    coords=scaled(p+[p[0]])
    for width,color in [(30,(240,222,171,56)),(21,(74,106,94,95)),(19,(202,203,166,255)),
                        (13,(84,112,97,155)),(11,(211,204,164,255)),(5,(88,98,75,255))]:
        sea.line(coords,fill=color,width=width*SCALE,joint="curve")

ink=ImageDraw.Draw(land,"RGBA")


def reserved(x,y):
    return any((x-px)**2+(y-py)**2<9**2 for px,py in points.values())


def mountain(x,y,h):
    w=h*rng.uniform(.7,1.2)
    profile=[(x-w,y),(x-.58*w,y-.35*h),(x-.4*w,y-.33*h),(x-.17*w,y-.71*h),
             (x,y-h),(x+.22*w,y-.66*h),(x+.37*w,y-.64*h),(x+.7*w,y-.25*h),(x+w,y)]
    dark=(95,86,61,142)
    ink.polygon(scaled(profile),fill=(197,180,133,228))
    ink.polygon(scaled([profile[4],(x+.04*w,y-.61*h),(x-.12*w,y-.49*h),
                        (x+.04*w,y-.31*h),(x-.04*w,y-.1*h),*reversed(profile[5:])]),fill=(139,140,105,155))
    ink.line(scaled(profile),fill=dark,width=2,joint="curve")
    for j in range(4):
        r=(j+1)/5
        ink.line(scaled([(x+w*.45*r,y-h*(1-r)*.9),(x+w*.53*r+1,y-h*(1-r)*.66),
                         (x+w*.85*r+1,y-h*(1-r)*.35)]),fill=(117,107,76,109),width=1)
    ink.line(scaled([profile[2],(x-.29*w,y-.5*h),(x-.23*w,y-.46*h),profile[4]]),
             fill=(245,229,184,207),width=2)


def tree(x,y,h):
    w=h*.36
    contour=[(x,y-h),(x+w*.65,y-h*.56),(x+w*.34,y-h*.56),(x+w,y-h*.17),
             (x+.11*w,y),(x-w,y-h*.15),(x-w*.45,y-h*.53),(x-w*.7,y-h*.50)]
    ink.polygon(scaled(contour),fill=rng.choice([(122,134,92,198),(141,146,100,200),(111,131,92,192)]))
    ink.line(scaled([contour[0],contour[7],contour[6],contour[5],contour[4],(x,y+1)]),fill=(76,90,65,179),width=1)
    ink.line(scaled([(x+.2*w,y-h*.63),(x+.48*w,y-h*.45)]),fill=(208,201,150,135),width=1)


# Broad terrain families, placed near their graph's corresponding regions.
ranges=[(307,76,87,35),(295,157,63,39),(167,314,61,31),(230,598,75,28),
        (322,716,87,22),(832,86,76,26),(759,185,47,23),(714,410,68,31),
        (840,461,48,40),(725,510,65,32),(744,567,45,23)]
woods=[(95,52,25,15),(202,124,37,39),(227,221,65,39),(352,214,29,40),
       (159,437,64,50),(158,563,66,32),(305,538,30,36),(644,145,48,31),
       (596,205,32,34),(818,202,60,30),(760,273,46,31),(782,380,49,22),
       (633,573,69,34),(672,637,70,36),(632,708,34,37),(816,599,44,29)]
shapes=[]
for regions,kind,density in [(ranges,"m",.016),(woods,"t",.09)]:
    for cx,cy,rx,ry in regions:
        for i in range(int(rx*ry*density)):
            a=rng.random()*math.tau
            rr=math.sqrt(rng.random())
            x,y=cx+rx*rr*math.cos(a),cy+ry*rr*math.sin(a)
            if not (0<x<W and 0<y<H) or reserved(x,y):
                continue
            if mask.getpixel(scaled([(x,y)])[0]):
                h=rng.uniform(7,19) if kind=="m" else rng.uniform(3.2,8)
                shapes.append((y,x,h,kind))
for y,x,h,kind in sorted(shapes):
    (mountain if kind=="m" else tree)(x,y,h)

for river in [
    "311 172 300 185 310 199 297 209 305 223 318 236 319 251 333 258 341 278 354 289 347 303 357 315 351 335 367 350 366 376 373 388 366 403 374 412",
    "237 539 247 545 246 555 260 562 274 559 286 569 300 568 318 575 335 571 352 579 369 580",
    "756 178 750 190 752 204 738 214 723 214 712 224 699 227 688 245 677 254 660 257",
    "786 392 776 390 764 398 754 390 744 391 733 381 716 382 704 372 690 379 679 364 658 366",
    "744 568 732 575 730 587 710 590 701 599 679 600 669 611 648 613 634 606 616 615 592 610 581 616 566 611 546 617"]:
    coords=scaled(pairs(river))
    ink.line(coords,fill=(131,145,113,210),width=4*SCALE,joint="curve")
    ink.line(coords,fill=(162,178,150,255),width=2*SCALE,joint="curve")
ocean.paste(land,mask=mask)
chart=ImageDraw.Draw(ocean,"RGBA")
for p in paths:
    chart.line(scaled(p+[p[0]]),fill=(87,86,63,221),width=2,joint="curve")


def font(size,italic=False):
    for name in [("palai.ttf" if italic else "pala.ttf"),("DejaVuSerif-Italic.ttf" if italic else "DejaVuSerif.ttf")]:
        try:
            return ImageFont.truetype(name,size*SCALE)
        except OSError:
            pass
    return ImageFont.load_default(size=size*SCALE)


def lettering(x,y,string,size,tracking=1.3,italic=False,angle=0):
    f=font(size,italic)
    lengths=[f.getlength(c) for c in string]
    width=round(sum(lengths)+tracking*SCALE*(len(string)-1))+12
    layer=Image.new("RGBA",(width,size*SCALE*3))
    d=ImageDraw.Draw(layer)
    shift=6
    for c,length in zip(string,lengths):
        d.text((shift,size*SCALE*1.5),c,font=f,fill=(58,65,51,245),anchor="lm",
               stroke_width=1,stroke_fill=(214,208,165,200))
        shift+=length+tracking*SCALE
    if angle:
        layer=layer.rotate(angle,Image.Resampling.BICUBIC,expand=True)
    dest=(round(x*SCALE-layer.width/2),round(y*SCALE-layer.height/2))
    ocean.paste(layer,dest,layer)


lettering(279,769,"KALIMDOR",19,3.4)
lettering(807,22,"EASTERN KINGDOMS",17,2.2)
lettering(88,106,"Teldrassil",12,.9,True)
lettering(495,91,"Zephras Isle",12,.9,True)
lettering(489,379,"The Great Sea",17,2.6,True,88)
output=Path(sys.argv[2]) if len(sys.argv)>2 else Path(__file__).with_name("azeroth.webp")
ocean.resize((W,H),Image.Resampling.LANCZOS).save(output,quality=91,method=6)
print(f"{len(points)} world places checked. Saved {output} ({output.stat().st_size:,} bytes).")
