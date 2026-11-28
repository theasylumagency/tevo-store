import type { Catalog, Product, ProductType } from "../catalog/types";
import type { DecisionEvent } from "../analytics/model";

/** Sector-level, brand-independent starter taxonomy. These are navigation
 * scopes, NOT model recommendations, compatibility evidence or suitability rules.
 * The later knowledge model can supply reviewed facts and more specific criteria. */
export interface DecisionTask {
  id: string;
  title: string;
  intro: string;
  icon: string;
  types: readonly string[];
  questions: readonly { title: string; detail: string }[];
  caution: string;
  event: DecisionEvent;
}
export const DECISION_TASKS: readonly DecisionTask[] = [
  { id: "soil", title: "მიწის დამუშავება", intro: "ნაკვეთის მომზადება, გაფხვიერება და რიგებს შორის მუშაობა.", icon: "AGRI_MACHINERY", types: ["MOTOBLOCK"],
    questions: [
      { title: "რა სამუშაო გაქვს?", detail: "მიწის პირველად დამუშავება, უკვე დამუშავებული ნიადაგის გაფხვიერება თუ რიგებს შორის მუშაობა?" },
      { title: "როგორია ნაკვეთი?", detail: "ფართობი, ნიადაგის მდგომარეობა, რიგების სიგანე და რელიეფი. შეადარე სამუშაო სიგანე, სიღრმე და წონა." },
      { title: "რა შედის კომპლექტში?", detail: "გადაამოწმე საჭირო ფრეზი, ბორბალი და სხვა დანადგარი; ცალკე გასაყიდი ნაწილის თავსებადობა და ღირებულებაც გაითვალისწინე." },
    ], caution: "ძრავის სიმძლავრე ან დამუშავების სიგანე მარტო ვერ ადგენს, რამდენად გამოგადგება კონკრეტული მოტობლოკი.", event: "task_soil_view" },
  { id: "grass", title: "ბალახისა და სარეველების გაკრეჭა", intro: "ეზოს, ბაღის, რიგებისა და ნაკვეთის მოვლა.", icon: "GARDEN_FORESTRY", types: ["BRUSHCUTTER"],
    questions: [
      { title: "რას ჭრი?", detail: "ბალახს, სქელ სარეველას თუ უფრო რთულ მცენარეულობას? შეამოწმე მწარმოებლის მიერ დაშვებული საჭრელი მოწყობილობა." },
      { title: "რამდენ ხანს და სად იმუშავებ?", detail: "ფართობი, დაბრკოლებები, რელიეფი და სამუშაოს ხანგრძლივობა; შეადარე წონა და ხელში დაჭერის პირობები." },
      { title: "რა დამატებითი აღჭურვილობა გჭირდება?", detail: "გადაამოწმე კომპლექტაცია, სახარჯი ნაწილები, უსაფრთხოების აღჭურვილობა და მათი ხარჯი." },
    ], caution: "საჭრელი ნაწილის დანიშნულება და დაშვებული გამოყენება კონკრეტული მოდელის ინსტრუქციით უნდა გადაამოწმო.", event: "task_grass_view" },
  { id: "water", title: "წყლის გადატუმბვა", intro: "წყლის წყაროდან მიღება, გადატანა და მორწყვა.", icon: "SPRAYING_IRRIGATION", types: ["WATER_PUMP"],
    questions: [
      { title: "საიდან და სად გადაგაქვს წყალი?", detail: "წყაროს სახეობა, სიმაღლის სხვაობა და მანძილი. დაადგინე შემწოვი და მიწოდების პირობები." },
      { title: "რა რაოდენობა გჭირდება?", detail: "საჭირო ნაკადი, მუშაობის დრო, წყლის მდგომარეობა და მილების ზომა; შეადარე მითითებული მახასიათებლები." },
      { title: "რა კავშირები და კვება გაქვს?", detail: "გადაამოწმე მილისა და შეერთებების ზომები, კომპლექტაცია და ენერგიის წყარო." },
    ], caution: "მაქსიმალური ნაკადი და მაქსიმალური აწევის სიმაღლე ჩვეულებრივ სხვადასხვა სამუშაო წერტილს აღწერს. რეალური პირობებისთვის საჭიროა მოდელის დადასტურებული მონაცემები.", event: "task_water_view" },
  { id: "spray", title: "მცენარეების შესხურება", intro: "ბაღის ან ნაკვეთის შესხურებისთვის აღჭურვილობის არჩევა.", icon: "SPRAYING_IRRIGATION", types: ["SPRAYER"],
    questions: [
      { title: "როგორ სივრცეში იმუშავებ?", detail: "მცენარეების სიმაღლე, ფართობი, რიგები და გადაადგილების პირობები." },
      { title: "როგორია დატვირთვა?", detail: "შეადარე ავზის მოცულობა, ცარიელი მოწყობილობის წონა, კვების წყარო და მუშაობის რეჟიმი." },
      { title: "რა უნდა იყოს თავსებადი?", detail: "გამოყენებამდე გადაამოწმე შესასხურებელი ნივთიერების ეტიკეტი, მოწყობილობის ინსტრუქცია, საქშენები და დაცვის მოთხოვნები." },
    ], caution: "მოწყობილობის არჩევა არ ნიშნავს კონკრეტული პრეპარატის ან დოზის რეკომენდაციას.", event: "task_spray_view" },
  { id: "power", title: "ელექტროენერგიის უზრუნველყოფა", intro: "ხელსაწყოების ან მოწყობილობების კვებისთვის გენერატორის არჩევა.", icon: "WORKSHOP_CONSTRUCTION", types: ["GENERATOR"],
    questions: [
      { title: "რას უნდა მიაწოდო ენერგია?", detail: "ჩამოწერე მოწყობილობები, მათი ნომინალური და გაშვების დატვირთვა; განსაზღვრე რომელი იმუშავებს ერთდროულად." },
      { title: "რა კვების მოთხოვნაა?", detail: "შეამოწმე ძაბვა, ფაზები, გამოსასვლელები და დასაშვები უწყვეტი დატვირთვა." },
      { title: "როგორ გამოიყენებ?", detail: "სამუშაოს ხანგრძლივობა, საწვავის საჭიროება, გადაადგილება და უსაფრთხო განთავსება." },
    ], caution: "მაქსიმალური სიმძლავრე უწყვეტი სიმძლავრის ტოლი არ არის. საწვავზე მომუშავე გენერატორის შენობაში გამოყენება დაუშვებელია; მონტაჟი სპეციალისტთან შეათანხმე.", event: "task_power_view" },
  { id: "parts", title: "ნაწილის ან დანადგარის შერჩევა", intro: "უკვე გაქვს ტექნიკა და გჭირდება ნაწილი, საბურავი ან მისაერთებელი მოწყობილობა.", icon: "SPARE_PARTS_ACCESSORIES", types: ["SPARE_PART", "AGRI_ATTACHMENT", "TIRE", "TUBE", "WHEEL_RIM", "ACCESSORY", "ENGINE", "IRRIGATION_ACCESSORY"],
    questions: [
      { title: "რომელი ტექნიკა გაქვს?", detail: "იპოვე ბრენდი, ზუსტი მოდელი, ნაწილის კოდი და საჭიროებისას სერიული ნომერი." },
      { title: "რა ზომა და შეერთებაა?", detail: "შეადარე ზომები, ნიშნულები და დამაგრების წესი. მხოლოდ გარეგნული მსგავსება საკმარისი არ არის." },
      { title: "არის თავსებადობის დადასტურება?", detail: "ნახე კონკრეტული მოდელის კავშირი ან წყაროში მითითებული მონაცემი; დაუზუსტებელი თავსებადობა გადაამოწმე შეკვეთამდე." },
    ], caution: "კატეგორიის, ბრენდის ან ერთი ზომის დამთხვევა კონკრეტულ მოდელთან თავსებადობას ავტომატურად არ ადასტურებს.", event: "task_parts_view" },
];
export function getDecisionTask(id: string | undefined): DecisionTask | undefined {
  return DECISION_TASKS.find(task => task.id === id);
}
export function tasksForType(type: string): DecisionTask[] {
  return DECISION_TASKS.filter(task => task.types.includes(type));
}
export interface TaskScope {
  products: Product[];
  groups: { type: ProductType; count: number }[];
}
export function taskScope(task: DecisionTask, catalog: Pick<Catalog, "product_types" | "products">): TaskScope {
  const types = catalog.product_types.filter(type => task.types.includes(type.id));
  const valid = new Set(types.map(type => type.id));
  const products = catalog.products.filter(p => p.visible && valid.has(p.product_type));
  const groups = types.map(type => ({ type, count: products.filter(p => p.product_type === type.id).length }))
    .filter(group => group.count > 0);
  return { products, groups };
}
export function availableTasks(catalog: Pick<Catalog, "product_types" | "products">) {
  return DECISION_TASKS.map(task => ({ task, count: taskScope(task, catalog).products.length })).filter(row => row.count > 0);
}
