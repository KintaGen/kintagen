# ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
#
#        LD50/ED50 Dose-Response Analysis - API Version
#
#   This script is designed for non-interactive execution by an API.
#   It takes a data URL as input, performs dose-response analysis,
#   generates a plot as a Base64 encoded string, and outputs all results
#   as a single R list object.
#
# ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

# ============================================================================
# 1. SETUP & INITIALIZATION
# ============================================================================
# Suppress startup messages for a cleaner API output
# This is the path INSIDE the WebR sandbox where our Node.js code
# has already copied the library files.
custom_lib_path <- "/home/web_user/r_library"

# Explicitly tell R to add our custom folder to its search path.
# This makes the script robust and is the final piece of the puzzle.
.libPaths(c(custom_lib_path, .libPaths()))

suppressPackageStartupMessages({
  #if (!requireNamespace("drc", quietly = TRUE)) webr::install("drc")
  #if (!requireNamespace("jsonlite", quietly = TRUE)) webr::install("jsonlite")
  #if (!requireNamespace("ggplot2", quietly = TRUE)) webr::install("ggplot2")
  #if (!requireNamespace("base64enc", quietly = TRUE)) webr::install("base64enc") # For Base64 encoding
  
  library(drc)
  library(jsonlite)
  library(ggplot2)
  library(base64enc)
})

# --- Initialize the final output list ---
output_data <- list(
  status = "processing",
  error = NULL,
  log = c(),
  results = list()
)

# --- Function to log messages ---
log_message <- function(msg) {
  message(msg) # sends to stderr
  output_data$log <<- c(output_data$log, msg)
}

# ============================================================================
# 2. HANDLE INPUT ARGUMENTS
# ============================================================================

# --- Helper function to check for missing/null/undefined arguments ---
is_arg_missing <- function(arg) {
  return(is.na(arg) || arg == "undefined" || arg == "null" || nchar(arg) == 0)
}

args <- commandArgs(trailingOnly = TRUE)
# A logging function for better feedback (optional, but good practice)
log_message <- function(msg) {
  message(paste(Sys.time(), "-", msg))
}

tryCatch({
    # NEW LOGIC: We check if a variable named 'inputData' was created by JavaScript.
    # The exists() function is key here.
    if (!exists("inputData") || is.na(inputData) || nchar(inputData) == 0) {
      log_message("No 'inputData' variable provided. Using internal sample data.")
      # Generate sample data if no input is given
      data <- data.frame(
        dose = c(0.1, 0.5, 1, 5, 10, 20),
        total = rep(50, 6),
        response = c(1, 5, 10, 25, 40, 48)
      )
    } else {
      # This logic remains the same! It checks if the string is a URL or raw data.
      is_url <- grepl("^https?://", inputData, perl = TRUE)

      if (is_url) {
        log_message(paste("Reading data from URL:", inputData))
        data <- read.csv(inputData)
      } else {
        log_message("Reading data from provided CSV text.")
        # Use the 'text' argument of read.csv to parse the string directly.
        data <- read.csv(text = inputData)
      }
    }
  },error = function(e) {
    log_message(paste("An error occurred:", e$message))
    output_data$status <<- "error"
    output_data$error <<- paste("Error data read:", e$message)
    cat(toJSON(output_data, auto_unbox = TRUE))
    quit(status = 0,save="no")
})


# ============================================================================
# 3. DOSE-RESPONSE ANALYSIS
# ============================================================================
tryCatch({
  log_message("Performing dose-response modeling...")
  model <- drm(response / total ~ dose, weights = total, data = data, fct = LL.2(), type = "binomial")
  
  # --- Calculate ED50 (LD50) ---
  ed_results <- ED(model, 50, interval = "delta", level = 0.95, display = FALSE)
  
  # --- Prepare results for JSON output ---
  model_summary_obj <- summary(model)
  
  output_data$results$ld50_estimate <- ed_results[1]
  output_data$results$standard_error <- ed_results[2]
  output_data$results$confidence_interval_lower <- ed_results[3]
  output_data$results$confidence_interval_upper <- ed_results[4]
  output_data$results$model_coefficients <- coef(model_summary_obj)
  
  log_message("Dose-response analysis complete.")
}, error = function(e) {
  output_data$status <<- "error"
  output_data$error <<- paste("Error during DRC modeling:", e$message)
  cat(toJSON(output_data, auto_unbox = TRUE))
  quit(status = 0,save="no")
})


# ============================================================================
# 4. GENERATE PLOT AS BASE64 STRING
# ============================================================================

# --- Function to save a ggplot and return its Base64 string ---
gg_to_base64 <- function(gg, width = 7, height = 5) {
  temp_file <- tempfile(fileext = ".png")
  ggsave(temp_file, plot = gg, width = width, height = height, dpi = 150)
  base64_string <- base64enc::base64encode(temp_file)
  unlink(temp_file)
  return(paste0("data:image/png;base64,", base64_string))
}

tryCatch({
  log_message("Generating plot...")
  
  # Prepare data for ggplot
  plot_data <- data.frame(
    dose = data$dose,
    proportion = data$response / data$total
  )
  
  min_dose_nonzero <- min(plot_data$dose[plot_data$dose > 0], na.rm = TRUE)
  max_dose <- max(plot_data$dose, na.rm = TRUE)
  curve_data <- data.frame(dose = exp(seq(log(min_dose_nonzero), log(max_dose), length.out = 100)))
  curve_data$p <- predict(model, newdata = curve_data)
  
  ld50_val <- output_data$results$ld50_estimate
  
  
  
  # Create the base plot with the main data (the 6 points)
  p_ld50 <- ggplot(plot_data, aes(x = dose, y = proportion)) +
    
    # --- Plot the main data points ---
    geom_point(size = 3, shape = 16) +
    
    # --- Plot the fitted curve ---
    # FIX 1: Use `linewidth` instead of `size` for lines.
    geom_line(data = curve_data, aes(x = dose, y = p), color = "blue", linewidth = 1) +
    
    # --- Add annotations for the LD50 value ---
    # FIX 2: Use `annotate()` for single graphical elements. This prevents the
    # "data has 6 rows" warning. Note that we don't use `aes()` inside annotate.
    
    # Red diamond at the LD50 point
    annotate("point", x = ld50_val, y = 0.5, color = "red", size = 4, shape = 18) +
    
    # Vertical dashed line
    annotate("segment", x = ld50_val, y = 0, xend = ld50_val, yend = 0.5, 
             linetype = "dashed", color = "darkgrey") +
    
    # Horizontal dashed line
    # FIX 3: Start the segment at a small positive value (`min_dose_nonzero`) instead of 0
    # to avoid the log-scale warning.
    annotate("segment", x = min_dose_nonzero, y = 0.5, xend = ld50_val, yend = 0.5, 
             linetype = "dashed", color = "darkgrey") +
    
    # Label for the LD50 value
    annotate("label", x = ld50_val, y = 0.1, label = sprintf("LD50 = %.3f", ld50_val), 
             hjust = 0, nudge_x = 0.05, fontface = "bold") +
    
    # --- Set scales and labels ---
    scale_x_log10(
      name = "Dose (log scale)", 
      breaks = scales::trans_breaks("log10", function(x) 10^x), 
      labels = scales::trans_format("log10", scales::math_format(10^.x))
    ) +
    labs(title = "Dose-Response Curve with LD50 Estimate", y = "Response Proportion") +
    annotation_logticks(sides = "b") +
    theme_bw() +
    theme(plot.title = element_text(hjust = 0.5, face = "bold"))
  
  # The rest of your script (calling gg_to_base64) remains the same.
  output_data$results$plot_b64 <- gg_to_base64(p_ld50)
  log_message("Plot generation complete (with warnings fixed).")
  
  log_message("Plot generation complete.")
}, error = function(e) {
  output_data$status <<- "error"
  output_data$error <<- paste("Error during plot generation:", e$message)
  # Don't quit, just report the error and return what we have
})


# ============================================================================
# 5. FINALIZE AND OUTPUT JSON
# ============================================================================
output_data$status <- ifelse(is.null(output_data$error), "success", "error")
toJSON(output_data, auto_unbox = TRUE, pretty = TRUE)
