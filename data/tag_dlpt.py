#!/usr/bin/env python3
"""Tag vocab with dlpt_level and append higher-level items. Run: python tag_dlpt.py"""
import json
from pathlib import Path

DLPT_BY_RANK = [
    (35, "0+"), (70, "1"), (100, "1+"), (130, "2"), (160, "2+"), (190, "3"), (999, "3+"),
]

def rank_to_dlpt(rank):
    for limit, level in DLPT_BY_RANK:
        if rank <= limit:
            return level
    return "3+"

# Additional items for DLPT 3 / 3+ / 4 / 4+ (formal, military, political, abstract)
EXTRA = [
    ("v116","verb","to negotiate","تَفَاوَضَ / يُفَاوِضُ","tafaawada / yufaawidu","ف و ض","تفاوض الطرفان على الاتفاق.","تفاوض / بيتفاوض","tifawad / beetfawad","Lev cognate.","تفاوضوا عالالاتفاق.",["politics","military"],"3",116),
    ("v117","verb","to implement / carry out","نَفَّذَ / يُنَفِّذُ","naffadha / yunaffidu","ن ف ذ","نفّذ الجيش الخطة.","نفّذ / بينفّذ","naffad / beenaffid","Same root.","الجيش نفّذ الخطة.",["military","action"],"3",117),
    ("v118","verb","to monitor / oversee","رَاقَبَ / يُرَاقِبُ","raaqaba / yuraaqibu","ر ق ب","راقبت الحدود عن كثب.","راقب / بيراقب","raaqab / biraqib","Cognate.","راقبوا الحدود.",["military","perception"],"3",118),
    ("v119","verb","to analyze","حَلَّلَ / يُحَلِّلُ","hallala / yuhallilu","ح ل ل","حلّل الخبراء التقرير.","حلّل / بيحلّل","hallal / bihallil","Cognate.","الخبراء حلّلوا التقرير.",["cognition","study"],"3+",119),
    ("v120","verb","to coordinate","نَسَّقَ / يُنَسِّقُ","nassaqa / yunassiqu","ن س ق","نسّق الضباط العملية.","نسّق / بينسّق","nassa' / beenassa'","Cognate.","الضباط نسّقوا العملية.",["military","action"],"3+",120),
    ("v121","verb","to evacuate","أَخْلَى / يُخْلِي","akhla / yukhlee","خ ل و","أخلى السكان المنطقة.","أخلى / بيخلي","akhla / bikhli","Cognate.","أخلوا المنطقة.",["military","motion"],"3+",121),
    ("v122","verb","to deploy","نَشَرَ / يَنْشُرُ","nashara / yanshuru","ن ش ر","نشرت القوات على الحدود.","نشر / بينشر","nashar / beenshar","Also publish.","نشرت القوات.",["military"],"4",122),
    ("v123","verb","to intercept","اعْتَرَضَ / يَعْتَرِضُ","i'tarada / ya'taridu","ع ر ض","اعترضت الدوريات الشاحنة.","اعترض / بيعترض","i'tarad / bee'tarid","Cognate.","الدوريات اعترضت الشاحنة.",["military"],"4",123),
    ("v124","verb","to authorize","أَذِنَ / يَأْذَنُ","adhina / ya'dhanu","أ ذ ن","أذن القائد بالهجوم.","أذن / بيأذن","adhin / bi'dhan","Cognate.","القائد أذن بالهجوم.",["military","politics"],"4",124),
    ("v125","verb","to ratify","صَدَّقَ / يُصَدِّقُ","saddaqa / yusaddiqu","ص د ق","صدّق البرلمان المعاهدة.","صدّق / بيصدّق","sadda' / bisadda'","Cognate.","البرلمان صدّق المعاهدة.",["politics"],"4",125),
    ("n101","noun","agreement / treaty","اِتِّفَاق / مُعَاهَدَة","ittifaaq / mu'aahada","و ف ق","وقّع الطرفان اتفاقاً.","اتفاق / معاهدة","itifaa' / mu'ahade","Same.","وقّعوا اتفاق.",["politics","military"],"3",101),
    ("n102","noun","operation","عَمَلِيَّة","amaliyya","ع م ل","بدأت العملية العسكرية.","عملية","amaliyye","Same.","بدأت العملية.",["military"],"3",102),
    ("n103","noun","border","حُدُود","huduud","ح د د","تأمين الحدود أولوية.","حدود","hduud","Same.","تأمين الحدود أولوية.",["military","place"],"3",103),
    ("n104","noun","intelligence","اسْتِخْبَارَات","istikhbaraat","خ ب ر","تلقت الاستخبارات معلومات.","استخبارات","istikhbáraat","Same.","الاستخبارات وصلها معلومات.",["military"],"3+",104),
    ("n105","noun","strategy","اِسْتِرَاتِيجِيَّة","istiraatiijiyya","ر أ ت","تغيّرت الاستراتيجية العسكرية.","استراتيجية","istiraatiijiyye","Same.","تغيّرت الاستراتيجية.",["military"],"3+",105),
    ("n106","noun","minister","وَزِير","wazeer","و ز ر","ألقى الوزير بياناً.","وزير","wazeer","Same.","الوزير ألقى بيان.",["politics"],"2+",106),
    ("n107","noun","parliament","بَرْلَمَان / مَجْلِس","barlamaan / majlis","م ج ل","عقد البرلمان جلسة طارئة.","برلمان / مجلس","barlamaan / majlis","Same.","البرلمان عقد جلسة.",["politics"],"3",107),
    ("n108","noun","economy","اِقْتِصَاد","iqtisaad","ق ص د","تعافى الاقتصاد تدريجياً.","اقتصاد","i'tisaad","Same.","الاقتصاد تعافى.",["politics","daily"],"2+",108),
    ("n109","noun","crisis","أَزْمَة","azma","ز م م","تفاقم الأزمة الإنسانية.","أزمة","azme","Same.","الأزمة تفاقمت.",["politics","daily"],"3",109),
    ("n110","noun","refugee","لَاجِئ","laaaji'","ل ج أ","وصل اللاجئون إلى المعبر.","لاجئ","laaji'","Same.","اللاجئين وصلوا.",["politics","social"],"3",110),
    ("n111","noun","infrastructure","بُنْيَة تَحْتِيَّة","bunya tahtiyya","ب ن ي","تضررت البنية التحتية.","بنية تحتية","bunye tahtiyye","Same.","البنية التحتية تضررت.",["politics"],"3+",111),
    ("n112","noun","negotiation","تَفَاوُض","tafaawud","ف و ض","استؤنفت المفاوضات أمس.","مفاوضات","mufawadaat","Plural common.","المفاوضات استؤنفت.",["politics"],"3+",112),
    ("n113","noun","ceasefire","وَقْف إِطْلَاق النَّار","waqf itlaaq annaar","و ق ف","أعلن وقف إطلاق النار.","وقف نار","wa'af naar","Short form.","أعلنوا وقف النار.",["military"],"4",113),
    ("n114","noun","sovereignty","سِيَادَة","siyaada","س و د","احترام السيادة الوطنية.","سيادة","siyaade","Same.","احترام السيادة.",["politics"],"4",114),
    ("n115","noun","constitution","دُسْتُور","dustoor","د س ر","نصّ الدستور على الحقوق.","دستور","dostoor","Same.","الدستور نصّ على الحقوق.",["politics"],"4",115),
    ("n116","noun","ambassador","سَفِير","safeer","س ف ر","التقى السفيران في القاهرة.","سفير","safeer","Same.","السفيران التقوا.",["politics"],"4",116),
    ("n117","noun","resolution (UN)","قَرَار","qaraar","ق ر ر","صدر قرار مجلس الأمن.","قرار","'araar","Same.","صدر القرار.",["politics"],"4",117),
    ("n118","noun","humanitarian aid","مَسَاعَدَة إِنْسَانِيَّة","musaa'ada insaaniyya","س ع د","وصلت المساعدة الإنسانية.","مساعدة إنسانية","musa'ade insaaniyye","Same.","وصلت المساعدة.",["politics"],"3+",118),
    ("n119","noun","election","اِنْتِخَابَات","intikhaabaat","خ ي ب","أُجريت الانتخابات العامة.","انتخابات","intikhaabaat","Same.","الانتخابات أُجريت.",["politics"],"3",119),
    ("n120","noun","demonstration / protest","مُظَاهَرَة","muzhaahara","ظ ه ر","نظمت مظاهرة سلمية.","مظاهرة","muzahara","Same.","نظموا مظاهرة.",["politics","social"],"3",120),
    # DLPT 4 / 4+ — formal news, military, diplomatic register
    ("v126","verb","to escalate","صَعَّدَ / يُصَعِّدُ","sa'ada / yusa'idu","ص ع د","صعّد الطرفان التصعيد العسكري بعد انهيار المحادثات.","صعّد / بيصعّد","sa'ad / bisa'id","Cognate.","صعّدوا التصعيد بعد المحادثات.",["military","politics"],"4+",126),
    ("v127","verb","to withdraw (troops)","اِنْسَحَبَ / يَنْسَحِبُ","insahaba / yansahibu","س ح ب","انسحبت القوات من المنطقة العازلة وفق الاتفاق.","انسحب / بينسحب","insahab / byinsahib","Cognate.","القوات انسحبت من المنطقة.",["military","motion"],"4+",127),
    ("v128","verb","to mobilize","حَشَدَ / يَحْشُدُ","hashada / yahshudu","ح ش د","حشدت القيادة قوات الاحتياط على الحدود الشمالية.","حشد / بيحشد","hashad / bihshid","Cognate.","القيادة حشدت قوات الاحتياط.",["military"],"4+",128),
    ("v129","verb","to impose sanctions","فَرَضَ عُقُوبَات","farada uqubat","ف ر ض","فرض مجلس الأمن عقوبات اقتصادية شاملة.","فرض عقوبات","farad u'ubat","MSA phrase.","فرضوا عقوبات اقتصادية.",["politics"],"4+",129),
    ("v130","verb","to mediate","تَوَسَّطَ / يَتَوَسَّطُ","tawassata / yatawassatu","و س ط","توسّطت الدولة في النزاع الإقليمي لوقف إطلاق النار.","توسّط / بيتوسّط","tawassat / beetwassat","Cognate.","توسّطوا في النزاع.",["politics","diplomacy"],"4",130),
    ("v131","verb","to condemn (politically)","اِسْتَنْكَرَ / يَسْتَنْكِرُ","istankara / yastankiru","ن ك ر","استنكر الوزراء التصعيد وأدانوا الهجوم على المدنيين.","استنكر / بيستنكر","istankar / byistankir","Cognate.","استنكروا التصعيد.",["politics"],"4",131),
    ("v132","verb","to reconvene (talks)","اِسْتَأْنَفَ / يَسْتَأْنِفُ","ista'nafa / yasta'nifu","أ ن ف","استأنف الوفدان المفاوضات بعد هدنة مؤقتة.","استأنف / بيستأنف","ista'naf / byista'nif","Cognate.","الوفدان استأنفوا المفاوضات.",["politics","diplomacy"],"4",132),
    ("n121","noun","sanctions","عُقُوبَات","uqubat","ق و ب","أدت العقوبات إلى تراجع الصادرات بشكل حاد.","عقوبات","'uqubat","Same.","العقوبات أثّرت على الصادرات.",["politics","economy"],"4+",121),
    ("n122","noun","alliance","تَحَالُف","tahaluf","ح ل ف","أعلنت الدول الثلاث تحالفاً دفاعياً مشتركاً.","تحالف","tahaluf","Same.","أعلنوا تحالفاً دفاعياً.",["military","politics"],"4+",122),
    ("n123","noun","aggression","عُدْوَان","udwaan","ع د و","أدان المجتمع الدولي العدوان على السيادة الوطنية.","عدوان","'udwaan","Same.","أدانوا العدوان.",["politics","military"],"4+",123),
    ("n124","noun","front (military)","جَبْهَة","jabha","ج ب ه","تشتد المعارك على الجبهة الشمالية منذ الفجر.","جبهة","jabhe","Same.","المعارك على الجبهة الشمالية.",["military"],"4+",124),
    ("n125","noun","mobilization","تَعْبِئَة / حَشْد","tabi'a / hashd","ع ب أ","أعلنت القيادة تعبئة عامة لقوات الاحتياط.","تعبئة / حشد","tabi'e / hashd","Both used.","أعلنوا تعبئة عامة.",["military"],"4+",125),
    ("n126","noun","diplomat","دِبْلُومَاسِي","diplomaasiy","د ب ل","التقى الدبلوماسيون في مقر الأمم المتحدة.","دبلوماسي","diplomasi","Same.","الدبلوماسيون التقوا.",["diplomacy","politics"],"4",126),
    ("n127","noun","envoy / delegate","وَفْد","wafd","و ف د","وصل الوفد إلى العاصمة لاستئناف المفاوضات.","وفد","wafd","Same.","الوفد وصل لاستئناف المفاوضات.",["diplomacy","politics"],"4",127),
    ("n128","noun","ceasefire violation","خَرْقِ وَقْفِ النَّار","kharq waqf annaar","خ ر ق","اتهم الطرفان بعضهما بخرق وقف إطلاق النار.","خرق وقف النار","khar' wa'af naar","Short form.","اتهموا بعض بخرق وقف النار.",["military"],"4+",128),
    ("n129","noun","humanitarian corridor","مَمَرٌّ إِنْسَانِي","mamar insaani","م ر ر","فُتح ممر إنساني لإيصال المساعدات إلى المدنيين.","ممر إنساني","mammar insaani","Same.","فتحوا ممراً إنسانياً.",["politics","military"],"4+",129),
    ("n130","noun","regional security","أَمْنٌ إِقْلِيمِيّ","amn iqlimee","أ م ن","ناقش القادة الأمن الإقليمي في القمة الطارئة.","أمن إقليمي","amn i'limi","Same.","ناقشوا الأمن الإقليمي.",["politics","military"],"4+",130),
    ("n131","noun","field assessment","تَقْيِيمٌ مَيْدَانِيّ","taqyeem maydani","ق ي م","بُني القرار على تقييم ميداني للوضع الأمني.","تقييم ميداني","taqyeem maydani","Same.","القرار مبني على تقييم ميداني.",["military","cognition"],"4+",131),
    ("n132","noun","defense policy","سِيَاسَةٌ دِفَاعِيَّة","siyaasa difaa'iyya","د ف ع","دعت الدراسة إلى إعادة تقييم السياسة الدفاعية.","سياسة دفاعية","siyase difaa'iyye","Same.","دعوا لإعادة تقييم السياسة الدفاعية.",["military","politics"],"4+",132),
    ("n133","noun","multilateral talks","مُفَاوَمَاتٌ مُتَعَدِّدَةُ الأَطْرَاف","mufawamaat muta'addidat al'atraf","ف و ض","تستأنف المفاوضات متعددة الأطراف الأسبوع المقبل.","مفاوضات متعددة الأطراف","mufawadaat muta'addidit l'atrāf","Formal.","المفاوضات متعددة الأطراف تستأنف.",["diplomacy","politics"],"4+",133),
    ("n134","noun","national sovereignty","سِيَادَةٌ وَطَنِيَّة","siyaada wataniyya","س و د","أكد البيان احترام السيادة الوطنية لجميع الدول.","سيادة وطنية","siyade wataniyye","Same.","أكدوا احترام السيادة الوطنية.",["politics"],"4+",134),
    ("n135","noun","armed faction","فَصِيلٌ مُسَلَّح","faseel musallah","ف ص ل","طالبت الفصائل المسلحة بوقف إطلاق النار فوراً.","فصيل مسلح","faseel musallah","Same.","الفصائل المسلحة طالبت بوقف النار.",["military","politics"],"4",135),
    ("n136","noun","peacekeeping force","قُوَّاتُ حِفْظِ السَّلام","quwwat hifz assalaam","ح ف ظ","انتشرت قوات حفظ السلام في المنطقة العازلة.","قوات حفظ السلام","'uwwat hifz essalaam","Same.","قوات حفظ السلام انتشرت.",["military","diplomacy"],"4",136),
]

def make_item(t):
    id_, typ, eng, msa_f, msa_t, root, msa_ex, lev_f, lev_t, lev_n, lev_ex, tags, dlpt, rank = t
    return {
        "id": id_, "type": typ, "english": eng, "dlpt_level": dlpt,
        "msa": {"form": msa_f, "translit": msa_t, "root": root, "example": msa_ex},
        "lev": {"form": lev_f, "translit": lev_t, "notes": lev_n, "example": lev_ex},
        "tags": tags, "frequency_rank": rank
    }

def main():
    data = json.loads(Path("vocab.json").read_text(encoding="utf-8"))
    existing_ids = {i["id"] for i in data["items"]}
    for item in data["items"]:
        rank = item.get("frequency_rank", 999)
        if "dlpt_level" not in item:
            item["dlpt_level"] = rank_to_dlpt(rank)
    for t in EXTRA:
        if t[0] not in existing_ids:
            data["items"].append(make_item(t))
    data["_meta"]["dlpt_levels"] = ["0+", "1", "1+", "2", "2+", "3", "3+", "4", "4+"]
    data["_meta"]["counts"] = {
        "verbs": sum(1 for i in data["items"] if i["type"] == "verb"),
        "nouns": sum(1 for i in data["items"] if i["type"] == "noun"),
        "total": len(data["items"]),
    }
    Path("vocab.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Tagged {len(data['items'])} items with dlpt_level")

if __name__ == "__main__":
    main()