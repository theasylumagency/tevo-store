/** Customer-facing copy only. Order and payment transitions remain server-owned. */
export interface CustomerOrderPresentation {
  tone: "neutral" | "success" | "warning";
  title: string;
  detail: string;
  canRetryPayment: boolean;
  received: boolean;
}

export function customerOrderPresentation(order: {
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  deliveryMethod?: string;
  deliveryFee?: number | null;
}): CustomerOrderPresentation {
  const base = { canRetryPayment: false, received: false };
  switch (order.status) {
    case "cancelled":
      return { ...base, tone: "neutral", title: "შეკვეთა გაუქმებულია.",
        detail: order.paymentStatus === "refunded" ? "თანხის დაბრუნება შესრულებულია. შეკვეთის დეტალები ქვემოთ არის შენახული."
          : order.paymentStatus === "paid" ? "გადახდისა და თანხის დაბრუნების დეტალებისთვის დაგვიკავშირდით და მიუთითეთ შეკვეთის ნომერი."
          : "ამ შეკვეთის შესრულება შეჩერებულია. ახალი შეკვეთისთვის შეგიძლიათ კატალოგში დაბრუნდეთ." };
    case "completed":
      return { ...base, tone: "success", title: "შეკვეთა დასრულებულია.", detail: "შეკვეთა შესრულებულია. პროდუქტებისა და გადახდის დეტალები ამ გვერდზეა შენახული." };
    case "ready_for_pickup":
      return { ...base, tone: "success", title: "შეკვეთა მზადაა გასატანად.", detail: "გატანის მისამართსა და დროს მაღაზიასთან შეათანხმებთ. დაკავშირებისას მიუთითეთ შეკვეთის ნომერი." };
    case "shipped":
      return { ...base, tone: "success", title: "შეკვეთა გამოგზავნილია.", detail: "მიწოდების შესახებ კითხვებისთვის დაგვიკავშირდით და მიუთითეთ შეკვეთის ნომერი." };
    case "confirmed":
      return { ...base, tone: "success", title: "შეკვეთა დადასტურებულია.", detail: "შეკვეთის მომდევნო სტატუსი და დეტალები ამავე გვერდზე შეგიძლიათ გადაამოწმოთ." };
    case "pending_payment": {
      const failed = order.paymentStatus === "failed";
      if (order.deliveryMethod === "delivery" && order.deliveryFee === null) {
        return { ...base, tone: "warning", title: "მიწოდების პირობები დასაზუსტებელია.",
          detail: "გადახდამდე საჭიროა სრული ღირებულების შეთანხმება. დაგვიკავშირდით და მიუთითეთ შეკვეთის ნომერი." };
      }
      return { ...base, tone: "warning", title: failed ? "გადახდა ვერ შესრულდა." : "შეკვეთა გადახდას ელოდება.",
        detail: failed ? "შეკვეთა შენახულია. შეგიძლიათ გადახდა ხელახლა სცადოთ ან გადახდის სხვა გზისთვის დაგვიკავშირდეთ."
          : "გადახდის დადასტურება ჯერ არ მიგვიღია. შეკვეთისა და გადახდის სტატუსი ქვემოთ ჩანს.",
        canRetryPayment: failed && (order.paymentMethod === "card" || order.paymentMethod === "installment") };
    }
    case "new":
      return { ...base, tone: "success", received: true, title: "გმადლობთ! შეკვეთა მიღებულია.",
        detail: order.paymentStatus === "paid" ? "გადახდა მიღებულია. შეკვეთის დეტალების დასადასტურებლად მალე დაგიკავშირდებით."
          : "შეკვეთის დეტალების დასადასტურებლად მითითებულ ტელეფონზე დაგიკავშირდებით." };
    default:
      return { ...base, tone: "neutral", title: "შეკვეთის ინფორმაცია", detail: "შეკვეთის მიმდინარე სტატუსი და დეტალები ქვემოთ ჩანს." };
  }
}
