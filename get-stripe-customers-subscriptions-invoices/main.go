package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/stripe/stripe-go/v84"
	"github.com/stripe/stripe-go/v84/customer"
	"github.com/stripe/stripe-go/v84/invoice"
	"github.com/stripe/stripe-go/v84/subscription"
)

// saveToJSON is a helper function that writes any data to a formatted JSON file
func saveToJSON(filename string, data interface{}) error {
	file, err := os.Create(filename)
	if err != nil {
		return fmt.Errorf("failed to create file %s: %w", filename, err)
	}
	defer file.Close()

	// Use an encoder to write directly to the file stream with indentation
	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(data); err != nil {
		return fmt.Errorf("failed to encode JSON to %s: %w", filename, err)
	}

	return nil
}

func main() {
	// 1. Load the variables from the .env file
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: No .env file found. Falling back to system environment variables.")
	}

	apiKey := os.Getenv("STRIPE_SECRET_KEY")
	if apiKey == "" {
		log.Fatal("Error: STRIPE_SECRET_KEY is not set in the .env file.")
	}

	// 2. Configure the Stripe API Client
	stripe.Key = apiKey

	// -----------------------------------------------------------------
	// 3. Fetch & Save All Customers
	// -----------------------------------------------------------------
	fmt.Println("Fetching customers...")
	customerParams := &stripe.CustomerListParams{}
	customerIter := customer.List(customerParams)

	var customers[]*stripe.Customer
	for customerIter.Next() {
		customers = append(customers, customerIter.Customer())
	}
	if err := customerIter.Err(); err != nil {
		log.Fatalf("Error fetching customers: %v", err)
	}

	err = saveToJSON("customers.json", customers)
	if err != nil {
		log.Fatalf("Error saving customers.json: %v", err)
	}
	fmt.Printf("✅ Saved %d customers to customers.json\n", len(customers))

	// -----------------------------------------------------------------
	// 4. Fetch & Save All Subscriptions
	// -----------------------------------------------------------------
	fmt.Println("Fetching subscriptions...")
	subParams := &stripe.SubscriptionListParams{}
	subIter := subscription.List(subParams)

	var subscriptions[]*stripe.Subscription
	for subIter.Next() {
		subscriptions = append(subscriptions, subIter.Subscription())
	}
	if err := subIter.Err(); err != nil {
		log.Fatalf("Error fetching subscriptions: %v", err)
	}

	err = saveToJSON("subscriptions.json", subscriptions)
	if err != nil {
		log.Fatalf("Error saving subscriptions.json: %v", err)
	}
	fmt.Printf("✅ Saved %d subscriptions to subscriptions.json\n", len(subscriptions))

	// -----------------------------------------------------------------
	// 5. Fetch & Save All Invoices
	// -----------------------------------------------------------------
	fmt.Println("Fetching invoices...")
	invParams := &stripe.InvoiceListParams{}
	invIter := invoice.List(invParams)

	var invoices[]*stripe.Invoice
	for invIter.Next() {
		invoices = append(invoices, invIter.Invoice())
	}
	if err := invIter.Err(); err != nil {
		log.Fatalf("Error fetching invoices: %v", err)
	}

	err = saveToJSON("invoices.json", invoices)
	if err != nil {
		log.Fatalf("Error saving invoices.json: %v", err)
	}
	fmt.Printf("✅ Saved %d invoices to invoices.json\n", len(invoices))
}
