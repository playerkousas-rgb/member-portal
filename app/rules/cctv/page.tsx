import Link from 'next/link';

export default function CctvRulesPage() {
  return (
    <>
      <Link href="/rules" className="backlink">← 返回守則及指引</Link>
      <article className="doc">
        <div className="doc-head">
          <h1>📹 閉路電視監察措施指引</h1>
          <div className="doc-meta">香港童軍總會筲箕灣區 · 區總部 · 修訂 12/2022</div>
        </div>

        <h2>甲、用途</h2>
        <ol>
          <li>保障總部內使用者安全。</li>
          <li>監察總部環境的安全及正常運作。</li>
          <li>保護總部內的設備及物品。</li>
        </ol>

        <h2>乙、實時監察</h2>
        <ol>
          <li>場地使用者均獲告知他們受到閉路電視的監察。</li>
          <li>實時監察只限於區總監或區總監授權人士。</li>
        </ol>

        <h2>丙、錄影</h2>
        <p>經閉路電視拍攝的影像一般只會保留一個月，如有執法部門要求將會按需要保存多於一個月。</p>

        <h2>丁、紀錄</h2>
        <ol>
          <li>翻查閉路電視紀錄時，操作閉路電視員工只限於包括區職員或區總監或區總監授權人士。</li>
          <li>筲箕灣區會在有足夠資料信納有關閉路電視紀錄是獲得《個人資料（私隱）條例》豁免下（如作出刑事調查時），並在區總監授權下，才向第三方披露資料。</li>
          <li>如對《個人資料（私隱）條例》或豁免條例有疑問，應致電香港個人資料私隱專員公署 2827 2827 熱線查詢。</li>
        </ol>

        <p className="src-note">內容來源：香港童軍總會筲箕灣區《閉路電視監察措施指引》(Rev. 12/2022)，已內建於本平台。</p>
      </article>
    </>
  );
}
